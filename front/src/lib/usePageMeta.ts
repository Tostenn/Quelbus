import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { SITE_URL } from './config'

const defaultDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''

function setMeta(selector: string, content: string) {
  document.querySelector(selector)?.setAttribute('content', content)
}

export function usePageMeta(title: string, description = defaultDescription) {
  const { pathname } = useLocation()

  useEffect(() => {
    const url = `${SITE_URL}${pathname}`
    document.title = title
    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[property="og:url"]', url)
    setMeta('meta[name="twitter:title"]', title)
    setMeta('meta[name="twitter:description"]', description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
  }, [title, description, pathname])
}
