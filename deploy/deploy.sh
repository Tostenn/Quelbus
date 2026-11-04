#!/usr/bin/env bash
#
# Déploiement de QuelBus sur le serveur.
#
#   ./deploy/deploy.sh          # back + front
#   ./deploy/deploy.sh back     # API Laravel seulement
#   ./deploy/deploy.sh front    # site seulement
#
# Front : dossier cloné sur la branche front-build (construite par GitHub Actions), un git pull suffit.
# Back  : git pull du dépôt, composer, migrations, caches, redémarrage des workers de file d'attente.
#
# Les chemins et binaires se surchargent par variables d'environnement, ex. :
#   PHP_BIN=/opt/cpanel/ea-php83/root/usr/bin/php ./deploy/deploy.sh back

# Tout le script est dans main(), appelée à la fin : bash lit donc le fichier en entier avant de
# l'exécuter, et le git pull du back peut modifier ce script sans casser l'exécution en cours.
main() {
    set -euo pipefail

    local BACK_DIR="${BACK_DIR:-/home/c2846100c/quelbus_remote/back}"
    local FRONT_DIR="${FRONT_DIR:-/home/c2846100c/public_html/quelbus.ci}"
    local FRONT_BRANCH="${FRONT_BRANCH:-front-build}"
    PHP_BIN="${PHP_BIN:-php}"
    COMPOSER_BIN="${COMPOSER_BIN:-composer}"

    local target="${1:-all}"
    case "$target" in
        back | front | all) ;;
        -h | --help)
            sed -n '3,13p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Argument inconnu : $target (attendu : back, front ou rien pour les deux)" >&2
            exit 1
            ;;
    esac

    # Un seul déploiement à la fois.
    exec 9>"${TMPDIR:-/tmp}/quelbus-deploy.lock"
    if command -v flock >/dev/null && ! flock -n 9; then
        echo "Un déploiement est déjà en cours." >&2
        exit 1
    fi

    local start=$SECONDS
    if [[ "$target" == back || "$target" == all ]]; then
        deploy_back "$BACK_DIR"
    fi
    if [[ "$target" == front || "$target" == all ]]; then
        deploy_front "$FRONT_DIR" "$FRONT_BRANCH"
    fi

    step "Déploiement terminé ($target) en $((SECONDS - start)) s"
}

step() { printf '\n\033[1;33m==>\033[0m \033[1m%s\033[0m\n' "$*"; }

artisan() { "$PHP_BIN" artisan "$@" --no-interaction; }

deploy_front() {
    local dir="$1" branch="$2"
    step "Front : $dir"

    if [[ ! -d "$dir/.git" ]]; then
        echo "$dir n'est pas un clone git. Première installation :" >&2
        echo "  git clone -b $branch https://github.com/Tostenn/Quelbus.git $dir" >&2
        exit 1
    fi

    local current
    current="$(git -C "$dir" rev-parse --abbrev-ref HEAD)"
    if [[ "$current" != "$branch" ]]; then
        echo "$dir est sur la branche « $current », attendu « $branch »." >&2
        exit 1
    fi

    # sitemap.xml est réécrit chaque heure par le back (sitemap:generate) : on rend la version
    # du dépôt pour que le pull passe, puis on le régénère aussitôt.
    git -C "$dir" checkout -- sitemap.xml 2>/dev/null || true
    git -C "$dir" pull --ff-only origin "$branch"
    echo "Front à jour : $(git -C "$dir" log -1 --format='%h %s')"

    step "Sitemap"
    if [[ -f "$BACK_DIR/artisan" ]]; then
        (cd "$BACK_DIR" && artisan sitemap:generate "$dir/sitemap.xml")
    else
        echo "Back introuvable ($BACK_DIR) : sitemap laissé tel quel, il sera réécrit à la prochaine heure."
    fi
}

deploy_back() {
    local dir="$1"
    step "Back : $dir"

    cd "$dir"
    if [[ ! -f .env ]]; then
        echo "$dir/.env est absent : copier .env.example, le remplir, puis lancer « php artisan key:generate »." >&2
        exit 1
    fi

    step "Récupération du code"
    git -C "$dir" pull --ff-only
    echo "Back à jour : $(git -C "$dir" log -1 --format='%h %s')"

    step "Maintenance activée"
    artisan down --retry=15 || true
    # Quoi qu'il arrive (erreur comprise), on remet le site en ligne en sortant.
    trap 'step "Maintenance désactivée"; "$PHP_BIN" artisan up || true' EXIT

    step "Dépendances PHP"
    "$COMPOSER_BIN" install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-progress

    step "Migrations"
    artisan migrate --force

    if [[ ! -e public/storage ]]; then
        step "Lien public/storage"
        artisan storage:link
    fi

    step "Caches (config, routes, vues, événements)"
    artisan optimize:clear
    artisan optimize

    step "Redémarrage des workers de file d'attente"
    # Les workers (queue:work) finissent leur tâche puis s'arrêtent : le superviseur ou la tâche cron
    # qui les lance les relance avec le nouveau code.
    artisan queue:restart

    "$PHP_BIN" artisan up
    trap - EXIT
    step "Maintenance désactivée"
}

main "$@"
exit
