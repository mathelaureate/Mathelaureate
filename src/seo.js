const SITE = 'https://www.mathelaureate.com'

const DEFAULT_DESCRIPTION =
  'IB and IGCSE maths lessons, worked examples, worksheets, and practice papers for Grade 9–12 students.'

const PUBLIC_PAGES = [
  {
    path: '/',
    title: 'Mathelaureate | IB and IGCSE Maths',
    description: DEFAULT_DESCRIPTION,
  },
  {
    path: '/programs',
    title: 'Maths Programs',
    description: 'IBDP Mathematics AA, IGCSE Additional Maths, and IGCSE International Maths pathways.',
  },
  {
    path: '/ia',
    title: 'Maths Internal Assessment',
    description: 'IB maths Internal Assessment examples, ideas, and guidance for students.',
  },
  {
    path: '/teachers-resources',
    title: 'Teachers & Resources',
    description: 'Classroom activities, worksheets, and teaching materials for IB and IGCSE maths.',
  },
  {
    path: '/papers',
    title: 'Practice Paper Generator',
    description: 'Build a 10-question IB and IGCSE maths practice paper and download it as a PDF.',
  },
  {
    path: '/mock-generator',
    title: 'Mock Exam Generator',
    description: 'Build custom IB and IGCSE maths mocks by unit for Paper 1, 2, and 3.',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy',
    description: 'How Mathelaureate collects, uses, and stores information on www.mathelaureate.com.',
  },
  {
    path: '/terms-of-use',
    title: 'Terms of Use',
    description: 'The terms that apply when you use Mathelaureate, create an account, or buy access.',
  },
]

const PRIVATE_PREFIXES = ['/admin', '/editor', '/profile', '/homework', '/courses']

function upsertMeta(attr, key, content) {
  if (!content) return
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function upsertCanonical(href) {
  let tag = document.head.querySelector('link[rel="canonical"]')
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', 'canonical')
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

export function applyPageMeta({ title, description, path = '/', index = true }) {
  const fullTitle = title?.includes('Mathelaureate') ? title : `${title || 'Mathelaureate'} | Mathelaureate`
  const summary = description || DEFAULT_DESCRIPTION
  const url = `${SITE}${path === '/' ? '/' : path}`
  document.title = fullTitle
  upsertMeta('name', 'description', summary)
  upsertMeta('property', 'og:title', fullTitle)
  upsertMeta('property', 'og:description', summary)
  upsertMeta('property', 'og:url', url)
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:image', `${SITE}/paper-logo.png`)
  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'robots', index ? 'index,follow' : 'noindex,nofollow')
  upsertCanonical(url)
}

export function metaForPath(pathname) {
  const path = pathname || '/'
  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return {
      title: 'Mathelaureate',
      description: DEFAULT_DESCRIPTION,
      path,
      index: false,
    }
  }
  const exact = PUBLIC_PAGES.find((page) => page.path === path)
  if (exact) return { ...exact, index: true }
  if (path.startsWith('/teachers-resources/')) {
    return {
      title: 'Teachers & Resources',
      description: 'A classroom worksheet or activity from Mathelaureate.',
      path,
      index: true,
    }
  }
  if (path.startsWith('/ia/')) {
    return {
      title: 'Maths Internal Assessment',
      description: 'An IB maths Internal Assessment example from Mathelaureate.',
      path,
      index: true,
    }
  }
  return { ...PUBLIC_PAGES[0], path: '/', index: true }
}
