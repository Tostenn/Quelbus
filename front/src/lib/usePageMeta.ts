import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { SITE_URL } from './config'

const defaultDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''

export function usePageMeta(title: string, description = defaultDescription) {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${SITE_URL}${pathname}`)
  }, [title, description, pathname])
}
