import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { auth, db } from './firebase'
import { supabaseConfigured, uploadImageToSupabase } from './supabase'
import './App.css'

const defaultCurricula = [
  {
    id: 'ibdp-aa-hl',
    name: 'IBDP AA HL',
    units: [
      {
        id: 'number-algebra',
        name: 'Topic 1: Number and Algebra',
        subunits: [
          'SL 1.1 Number systems and exact values',
          'SL 1.2 Arithmetic and geometric sequences',
          'SL 1.3 Exponents and logarithms basics',
          'SL 1.4 Financial mathematics and growth/decay',
          'SL 1.5 Binomial expansion (positive integer powers)',
          'SL 1.6 Proof basics and counterexamples',
          'SL 1.7 Simultaneous linear equations (2x2)',
          'SL 1.8 Basic counting principles',
          'SL 1.9 Introduction to complex numbers',
          'AHL 1.10 Counting principles, permutations and combinations',
          'AHL 1.11 Partial fractions',
          'AHL 1.12 Complex numbers in Cartesian form',
          'AHL 1.13 Polar/Euler form and complex operations',
          'AHL 1.14 De Moivre theorem and complex roots',
          'AHL 1.15 Proof by induction, contradiction and counterexample',
          'AHL 1.16 Systems of linear equations (up to 3x3)',
        ],
      },
      {
        id: 'functions',
        name: 'Topic 2: Functions',
        subunits: [
          'SL 2.1 Function notation, domain and range',
          'SL 2.2 Composite and inverse functions',
          'SL 2.3 Transformations of graphs',
          'SL 2.4 Exponential and logarithmic models',
          'SL 2.5 Solving equations graphically and algebraically',
          'SL 2.6 Rational functions and asymptotes (intro)',
          'SL 2.7 Piecewise and absolute value functions',
          'SL 2.8 Function modelling in context',
          'SL 2.9 Rate of change from graphs',
          'SL 2.10 Sequences as functions',
          'SL 2.11 Technology-based graph interpretation',
          'AHL 2.12 Polynomial functions, factors and roots',
          'AHL 2.13 Rational functions and asymptotes',
          'AHL 2.14 Odd/even/periodic and inverse functions',
          'AHL 2.15 Solving g(x) >= f(x)',
          'AHL 2.16 Modulus functions and equations/inequalities',
        ],
      },
      {
        id: 'geometry-trigonometry',
        name: 'Topic 3: Geometry and Trigonometry',
        subunits: [
          'SL 3.1 Coordinate geometry of lines',
          'SL 3.2 Distance, midpoint and gradient',
          'SL 3.3 Basic vector notation and operations',
          'SL 3.4 Trigonometric ratios and unit circle',
          'SL 3.5 Sine/cosine rules and area of triangle',
          'SL 3.6 Trig graphs and simple equations',
          'SL 3.7 Radians, arc length and sector area',
          'SL 3.8 2D vectors in geometric problems',
          'AHL 3.9 Reciprocal trig functions and inverse trig graphs',
          'AHL 3.10 Compound-angle identities',
          'AHL 3.11 Symmetry relationships in trig functions',
          'AHL 3.12 Vector basics in 2D/3D',
          'AHL 3.13 Scalar (dot) product and angle between vectors',
          'AHL 3.14 Vector equations of lines',
          'AHL 3.15 Coincident, parallel, intersecting and skew lines',
          'AHL 3.16 Vector (cross) product and geometric interpretation',
          'AHL 3.17 Vector and Cartesian equations of planes',
          'AHL 3.18 Intersections and angles of lines/planes',
        ],
      },
      {
        id: 'statistics-probability',
        name: 'Topic 4: Statistics and Probability',
        subunits: [
          'SL 4.1 Data collection and sampling methods',
          'SL 4.2 Measures of central tendency and spread',
          'SL 4.3 Histograms and cumulative frequency',
          'SL 4.4 Correlation and linear regression',
          'SL 4.5 Probability basics and set notation',
          'SL 4.6 Conditional probability',
          'SL 4.7 Discrete random variables',
          'SL 4.8 Binomial distribution',
          'SL 4.9 Normal distribution',
          'SL 4.10 Expected value and variance basics',
          'SL 4.11 Hypothesis testing (intro)',
          'SL 4.12 Interpretation of statistical results',
          'AHL 4.13 Bayes theorem (up to 3 events)',
          'AHL 4.14 Discrete/continuous random variables, E(X), Var(X)',
        ],
      },
      {
        id: 'calculus',
        name: 'Topic 5: Calculus',
        subunits: [
          'SL 5.1 Limits and continuity (intro)',
          'SL 5.2 Derivative as rate of change',
          'SL 5.3 Differentiation rules and tangent/normal',
          'SL 5.4 Increasing/decreasing and extrema',
          'SL 5.5 Optimization in context',
          'SL 5.6 Antiderivatives and definite integrals',
          'SL 5.7 Area under a curve',
          'SL 5.8 Kinematics with calculus',
          'SL 5.9 Differential equations (intro modelling)',
          'SL 5.10 Numerical methods for roots',
          'SL 5.11 Numerical integration basics',
          'AHL 5.12 Continuity, differentiability and first principles',
          "AHL 5.13 Limits with l'Hopital or Maclaurin methods",
          'AHL 5.14 Implicit differentiation, related rates, optimization',
          'AHL 5.15 Advanced derivatives/integrals and partial fractions links',
          'AHL 5.16 Integration by substitution and by parts',
          'AHL 5.17 Areas and volumes of revolution',
          'AHL 5.18 First-order differential equations',
          'AHL 5.19 Maclaurin series expansions and manipulations',
        ],
      },
    ],
  },
  {
    id: 'ibdp-ai-hl',
    name: 'IBDP AI HL',
    units: [
      {
        id: 'ai-number-algebra',
        name: 'Topic 1: Number and Algebra',
        subunits: [
          'SL 1.1 Number sets, scientific notation, and exact forms',
          'SL 1.2 Arithmetic and geometric sequences',
          'SL 1.3 Financial mathematics (simple and compound growth)',
          'SL 1.4 Exponents and logarithm basics',
          'SL 1.5 Basic binomial expansion',
          'SL 1.6 Introduction to proof and counterexample',
          'SL 1.7 Solving linear and quadratic equations',
          'SL 1.8 Introductory matrices (awareness level)',
          'AHL 1.9 Laws of logarithms',
          'AHL 1.10 Rational exponents and simplification',
          'AHL 1.11 Infinite geometric series',
          'AHL 1.12 Complex numbers in Cartesian form',
          'AHL 1.13 Polar/exponential form of complex numbers',
          'AHL 1.14 Matrix algebra and inverses',
          'AHL 1.15 Eigenvalues/eigenvectors of 2x2 matrices',
        ],
      },
      {
        id: 'ai-functions',
        name: 'Topic 2: Functions',
        subunits: [
          'SL 2.1 Function notation, domain and range',
          'SL 2.2 Composite and inverse functions',
          'SL 2.3 Graph transformations',
          'SL 2.4 Exponential and logarithmic models',
          'SL 2.5 Piecewise and absolute value functions',
          'SL 2.6 Technology-enabled graph interpretation',
          'AHL 2.7 Composite and inverse functions in context',
          'AHL 2.8 Graph transformations',
          'AHL 2.9 HL modelling (logistic, shifted sinusoidal, piecewise)',
          'AHL 2.10 Log scaling and linearization',
        ],
      },
      {
        id: 'ai-geometry-trig',
        name: 'Topic 3: Geometry and Trigonometry',
        subunits: [
          'SL 3.1 Trigonometric ratios and identities (core)',
          'SL 3.2 Sine/cosine rules and area formulas',
          'SL 3.3 Trigonometric graphs and equations',
          'SL 3.4 Radian measure and arc/sector applications',
          'SL 3.5 Vectors in 2D (notation and operations)',
          'SL 3.6 Geometric applications of vectors',
          'AHL 3.7 Radians and arc/sector measures',
          'AHL 3.8 Unit-circle trig and finite-interval equations',
          'AHL 3.9 Matrix transformations and fractals',
          'AHL 3.10 Vectors fundamentals',
          'AHL 3.11 Vector equations of lines',
          'AHL 3.12 Vector kinematics in 2D/3D',
          'AHL 3.13 Dot/cross product applications',
          'AHL 3.14 Graph theory fundamentals',
          'AHL 3.15 Adjacency/transition matrices and walks',
          'AHL 3.16 Network algorithms (MST, Chinese postman, TSP bounds)',
        ],
      },
      {
        id: 'ai-stats-prob',
        name: 'Topic 4: Statistics and Probability',
        subunits: [
          'SL 4.1 Data collection and sampling methods',
          'SL 4.2 Measures of central tendency and dispersion',
          'SL 4.3 Probability rules and conditional probability',
          'SL 4.4 Discrete random variables and expectation',
          'SL 4.5 Binomial distribution',
          'SL 4.6 Normal distribution',
          'SL 4.7 Correlation and linear regression',
          'SL 4.8 Introduction to hypothesis testing',
          'SL 4.9 Statistical inference using technology',
          'SL 4.10 Interpreting model validity in context',
          'SL 4.11 Communication of statistical findings',
          'AHL 4.12 Data collection design, reliability and validity',
          'AHL 4.13 Non-linear regression and R^2',
          'AHL 4.14 Linear transformations of random variables',
          'AHL 4.15 Central limit theorem',
          'AHL 4.16 Confidence intervals for means',
          'AHL 4.17 Poisson distribution and model selection',
          'AHL 4.18 Hypothesis testing (normal/binomial/Poisson/correlation)',
          'AHL 4.19 Transition matrices and Markov chains',
        ],
      },
      {
        id: 'ai-calculus',
        name: 'Topic 5: Calculus',
        subunits: [
          'SL 5.1 Limits and continuity basics',
          'SL 5.2 Derivative as local rate of change',
          'SL 5.3 Differentiation rules and tangent problems',
          'SL 5.4 Optimization and curve behavior',
          'SL 5.5 Antiderivatives and definite integrals',
          'SL 5.6 Area under and between curves',
          'SL 5.7 Kinematics using differentiation/integration',
          'SL 5.8 Introductory differential equations in modelling',
          'AHL 5.9 Derivative rules and related rates',
          'AHL 5.10 Second derivative, concavity and classification',
          'AHL 5.11 HL integration techniques',
          'AHL 5.12 Areas and volumes of revolution',
          'AHL 5.13 Kinematics in calculus form',
          'AHL 5.14 Differential equations by separation',
          'AHL 5.15 Slope fields',
          'AHL 5.16 Euler method for first-order systems',
          'AHL 5.17 Phase portraits for coupled systems',
          'AHL 5.18 Second-order differential equations',
        ],
      },
    ],
  },
  {
    id: 'igcse-add-maths',
    name: 'IGCSE Additional Mathematics 0606',
    units: [
      {
        id: 'add-func',
        name: '1. Functions',
        subunits: ['Function notation', 'Domain/range', 'Inverse and composite functions', 'Sketches and reflections'],
      },
      {
        id: 'add-quad',
        name: '2. Quadratic Functions',
        subunits: ['Completing the square', 'Discriminant and roots', 'Quadratic inequalities'],
      },
      { id: 'add-poly', name: '3. Factors of Polynomials', subunits: ['Remainder/factor theorem', 'Cubic factorization', 'Solving cubic equations'] },
      { id: 'add-eq', name: '4. Equations, Inequalities and Graphs', subunits: ['Modulus equations', 'Modulus inequalities', 'Cubic graph inequalities'] },
      { id: 'add-sim', name: '5. Simultaneous Equations', subunits: ['Linear-nonlinear systems', 'Elimination/substitution', 'Algebraic solving strategies'] },
      { id: 'add-logexp', name: '6. Logarithmic and Exponential Functions', subunits: ['Laws of logs', 'Graphs of e^x and ln x', 'Solving a^x = b'] },
      { id: 'add-line', name: '7. Straight-line Graphs', subunits: ['Parallel/perpendicular conditions', 'Midpoint and bisectors', 'Linearization techniques'] },
      { id: 'add-circle', name: '8. Coordinate Geometry of the Circle', subunits: ['Circle equations', 'Line-circle intersections', 'Tangents and two-circle intersections'] },
      { id: 'add-circular', name: '9. Circular Measure', subunits: ['Radian measure', 'Arc length', 'Sector area'] },
      { id: 'add-trig', name: '10. Trigonometry', subunits: ['Trig graphs', 'Identities', 'Trig equations and proofs'] },
      { id: 'add-perm', name: '11. Permutations and Combinations', subunits: ['n!', 'Permutations', 'Combinations', 'Counting applications'] },
      { id: 'add-series', name: '12. Series', subunits: ['Binomial expansion', 'Arithmetic/geometric series', 'Sigma notation'] },
      { id: 'add-vectors', name: '13. Vectors in Two Dimensions', subunits: ['Vector algebra', 'Magnitude/direction', 'Geometric applications'] },
      { id: 'add-calc', name: '14. Calculus', subunits: ['Differentiation', 'Stationary points', 'Integration and area', 'Kinematics applications'] },
    ],
  },
  {
    id: 'igcse-intl-maths',
    name: 'IGCSE International Mathematics 0607',
    units: [
      {
        id: 'intl-number',
        name: '1. Number',
        subunits: [
          'Types of number and sets',
          'Fractions/decimals/percentages',
          'Ratio, proportion and rates',
          'Standard form and estimation',
          'Interest, money and time calculations',
        ],
      },
      {
        id: 'intl-algebra',
        name: '2. Algebra',
        subunits: [
          'Expressions and manipulation',
          'Indices and algebraic fractions',
          'Linear and simultaneous equations',
          'Inequalities',
          'Sequences and nth-term forms',
        ],
      },
      {
        id: 'intl-functions',
        name: '3. Functions',
        subunits: ['Function notation', 'Graph recognition', 'Graph features with GDC', 'Extended function operations'],
      },
      {
        id: 'intl-coordinate',
        name: '4. Coordinate Geometry',
        subunits: ['Coordinates and gradients', 'Length/midpoint', 'Line equations', 'Parallel/perpendicular lines'],
      },
      {
        id: 'intl-geometry',
        name: '5. Geometry',
        subunits: ['Angles and polygons', 'Similarity/congruence', 'Constructions and loci', 'Circle theorems'],
      },
      {
        id: 'intl-mensuration',
        name: '6. Mensuration',
        subunits: ['Perimeter and area', 'Surface area and volume', 'Compound measures', 'Practical geometry contexts'],
      },
      {
        id: 'intl-trig',
        name: '7. Trigonometry',
        subunits: ['Right-angled trig', 'Sine/cosine rules', 'Bearings and 3D applications', 'Trig graph basics'],
      },
      {
        id: 'intl-transform-vectors',
        name: '8. Transformations and Vectors',
        subunits: ['Transformations', 'Combined transformations', 'Vector notation and operations', 'Vector geometry applications'],
      },
      {
        id: 'intl-prob',
        name: '9. Probability',
        subunits: ['Sample spaces', 'Combined events', 'Conditional probability', 'Expected value'],
      },
      {
        id: 'intl-stats',
        name: '10. Statistics',
        subunits: ['Data representation', 'Central tendency and spread', 'Correlation and regression', 'Investigation and modelling questions'],
      },
    ],
  },
  {
    id: 'ibmyp',
    name: 'IBMYP',
    units: [
      { id: 'number', name: 'Number', subunits: ['Integers', 'Fractions'] },
      { id: 'relations', name: 'Relationships', subunits: ['Patterns', 'Graphing'] },
    ],
  },
]

const adminPasscode = (import.meta.env.VITE_ADMIN_PASSCODE || '').trim()
const adminPasscodeKey = 'mathelaureate-admin-passcode-ok'
const adminEventsOptionId = '__events_management__'
const adminTeachersResourcesOptionId = '__teachers_resources_management__'
const profileCacheKey = 'mathelaureate-profile-cache'
const curriculaDocRef = doc(db, 'appData', 'curricula')
const contentItemsCollectionRef = collection(db, 'courseContentItems')
const paywallDocRef = doc(db, 'appData', 'paywall')
const eventsDocRef = doc(db, 'appData', 'events')
const teachersResourcesDocRef = doc(db, 'appData', 'teachersResources')
const paymentApiBaseUrl = (import.meta.env.VITE_PAYMENT_API_BASE_URL || '/api').replace(/\/$/, '')

function normalizePaywallConfig(raw) {
  return {
    coursePrices: raw?.coursePrices && typeof raw.coursePrices === 'object' ? raw.coursePrices : {},
    lockedUnits: raw?.lockedUnits && typeof raw.lockedUnits === 'object' ? raw.lockedUnits : {},
    lockedSubunits: raw?.lockedSubunits && typeof raw.lockedSubunits === 'object' ? raw.lockedSubunits : {},
  }
}

function normalizeEvents(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => ({
      id: item?.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(item?.title || '').trim(),
      date: String(item?.date || '').trim(),
      description: String(item?.description || '').trim(),
      link: String(item?.link || '').trim(),
      imageUrl: String(item?.imageUrl || '').trim(),
      imagePath: String(item?.imagePath || '').trim(),
    }))
    .filter((item) => item.title && item.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function normalizeTeachersResourcesPosts(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => ({
      id: item?.id || `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(item?.title || '').trim(),
      description: String(item?.description || '').trim(),
      link: String(item?.link || '').trim(),
      imageUrl: String(item?.imageUrl || '').trim(),
      imagePath: String(item?.imagePath || '').trim(),
      createdAt: String(item?.createdAt || ''),
    }))
    .filter((item) => item.title && item.description)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

async function ensureRazorpayLoaded() {
  if (typeof window === 'undefined') return false
  if (window.Razorpay) return true
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderLatexToHtml(value) {
  if (!value) return ''

  const text = String(value)
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g
  const parts = text.split(pattern).filter(Boolean)

  return parts
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const expression = part.slice(2, -2).trim()
        return katex.renderToString(expression, { throwOnError: false, displayMode: true })
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        const expression = part.slice(1, -1).trim()
        return katex.renderToString(expression, { throwOnError: false, displayMode: false })
      }
      return escapeHtml(part).replaceAll('\n', '<br />')
    })
    .join('')
}

function LatexText({ value, className = '' }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderLatexToHtml(value) }} />
}

function toGeoGebraEmbedUrl(input) {
  const rawInput = String(input || '').trim()
  const iframeSrcMatch = rawInput.match(/src=["']([^"']+)["']/i)
  const raw = String(iframeSrcMatch?.[1] || rawInput).trim()
  if (!raw) return ''
  if (raw.includes('geogebra.org/material/iframe/id/')) return raw

  const idMatch =
    raw.match(/geogebra\.org\/m\/([a-zA-Z0-9]+)/) ||
    raw.match(/material\/show\/id\/([a-zA-Z0-9]+)/) ||
    raw.match(/^([a-zA-Z0-9]{6,})$/)
  const materialId = idMatch?.[1]
  if (!materialId) return raw
  return `https://www.geogebra.org/material/iframe/id/${materialId}/width/900/height/520/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/true/rc/false`
}

function toGeoGebraOpenUrl(input) {
  const rawInput = String(input || '').trim()
  const iframeSrcMatch = rawInput.match(/src=["']([^"']+)["']/i)
  const raw = String(iframeSrcMatch?.[1] || rawInput).trim()
  if (!raw) return ''
  if (raw.includes('geogebra.org/material/iframe/id/')) {
    const iframeMatch = raw.match(/material\/iframe\/id\/([a-zA-Z0-9]+)/)
    return iframeMatch?.[1] ? `https://www.geogebra.org/m/${iframeMatch[1]}` : 'https://www.geogebra.org/'
  }
  const idMatch =
    raw.match(/geogebra\.org\/m\/([a-zA-Z0-9]+)/) ||
    raw.match(/material\/show\/id\/([a-zA-Z0-9]+)/) ||
    raw.match(/^([a-zA-Z0-9]{6,})$/)
  const materialId = idMatch?.[1]
  if (materialId) return `https://www.geogebra.org/m/${materialId}`
  return raw
}

async function detectUserCountryCode() {
  try {
    const response = await fetch('https://ipapi.co/json/', { cache: 'no-store' })
    if (!response.ok) return ''
    const data = await response.json()
    return String(data?.country_code || '').toUpperCase()
  } catch {
    return ''
  }
}

function toYouTubeEmbedUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const watchMatch = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)
  const shortMatch = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)
  const embedMatch = raw.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/)
  const id = watchMatch?.[1] || shortMatch?.[1] || embedMatch?.[1]
  if (!id) return ''
  return `https://www.youtube.com/embed/${id}`
}
const courseCatalog = [
  {
    slug: 'ibdp-aa',
    title: 'IBDP AA',
    curriculumId: 'ibdp-aa-hl',
    description: 'Proof-oriented pathway for strong algebraic reasoning and advanced calculus.',
    highlights: ['Functions and Calculus depth', 'Rigorous algebraic manipulation', 'Exam strategy by paper type'],
  },
  {
    slug: 'ibdp-ai',
    title: 'IBDP AI',
    curriculumId: 'ibdp-ai-hl',
    description: 'Data-centered pathway focused on modeling and real-world applications.',
    highlights: ['Modeling and interpretation', 'Technology-focused approaches', 'Statistics with context'],
  },
  {
    slug: 'igcse-additional',
    title: 'IGCSE Additional Maths',
    curriculumId: 'igcse-add-maths',
    description: 'Core and Extended preparation with exam-focused checkpoints.',
    highlights: ['Structured concept progression', 'Past-paper style practice', 'Skill-by-skill reinforcement'],
  },
  {
    slug: 'igcse-international',
    title: 'IGCSE International Maths',
    curriculumId: 'igcse-intl-maths',
    description: 'International pathway with broad concept coverage and application-focused problem solving.',
    highlights: ['Clear concept sequencing', 'Exam-style mixed practice', 'Applied mathematical thinking'],
  },
  {
    slug: 'ibmyp',
    title: 'IBMYP',
    curriculumId: 'ibmyp',
    description: 'Concept-based approach to deepen mathematical communication and logic.',
    highlights: ['Criterion-aligned support', 'Investigation and communication', 'Bridge to DP readiness'],
  },
]
function ensureRequiredCurricula(cachedCurricula) {
  if (!Array.isArray(cachedCurricula)) return defaultCurricula

  function parseSubunitOrder(label) {
    const match = String(label).match(/(?:^|\s)(\d+)\.(\d+)\b/)
    if (!match) return null
    return { major: Number(match[1]), minor: Number(match[2]) }
  }

  function sortSubunitsInNumericOrder(subunits) {
    if (!Array.isArray(subunits)) return []
    return subunits
      .map((label, index) => ({ label, index, order: parseSubunitOrder(label) }))
      .sort((a, b) => {
        if (a.order && b.order) {
          if (a.order.major !== b.order.major) return a.order.major - b.order.major
          if (a.order.minor !== b.order.minor) return a.order.minor - b.order.minor
          return a.index - b.index
        }
        if (a.order && !b.order) return -1
        if (!a.order && b.order) return 1
        return a.index - b.index
      })
      .map((item) => item.label)
  }

  function normalizeCourseOrdering(course) {
    return {
      ...course,
      units: (course.units || []).map((unit) => ({
        ...unit,
        subunits: sortSubunitsInNumericOrder(unit.subunits || []),
      })),
    }
  }

  const savedById = new Map(cachedCurricula.map((course) => [course.id, course]))
  const merged = defaultCurricula.map((defaultCourse) => {
    const savedCourse = savedById.get(defaultCourse.id)
    if (!savedCourse) return normalizeCourseOrdering(defaultCourse)
    return normalizeCourseOrdering({
      ...savedCourse,
      name: savedCourse.name || defaultCourse.name,
      units: Array.isArray(savedCourse.units) ? savedCourse.units : [],
    })
  })

  const additionalCourses = cachedCurricula
    .filter((savedCourse) => !defaultCurricula.some((defaultCourse) => defaultCourse.id === savedCourse.id))
    .map((course) => normalizeCourseOrdering(course))
  return [...merged, ...additionalCourses]
}

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return list
  const copy = [...list]
  const [item] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, item)
  return copy
}

function SiteHeader({ user, cachedProfile, bare = false }) {
  const profileLabel =
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    cachedProfile?.displayName?.[0]?.toUpperCase() ||
    cachedProfile?.email?.[0]?.toUpperCase() ||
    'P'
  const navigate = useNavigate()

  function onLoginSignupClick() {
    navigate('/courses/ibdp-aa')
  }

  return (
    <header className={`topbar ${bare ? 'topbar-bare' : ''}`} id="home">
      <div className="brand">
        Mathe<span>laureate</span>
        </div>
      <nav>
        <a href="/#home">Home</a>
        <a href="/#programs">Programs</a>
        <Link to="/events">Events</Link>
        <a href="/#testimonials">Testimonials</a>
        <a href="/#contact">Contact</a>
        {user || cachedProfile ? (
          <Link to="/profile" className="profile-icon" aria-label="Profile">
            {profileLabel}
          </Link>
        ) : (
          <button type="button" className="login-btn" onClick={onLoginSignupClick}>
            Login/Signup
          </button>
        )}
      </nav>
    </header>
  )
}

function HomePage({ user, cachedProfile }) {
  const location = useLocation()
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactSubject, setContactSubject] = useState('General inquiry')
  const [contactMessage, setContactMessage] = useState('')
  const [contactFeedback, setContactFeedback] = useState('')

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace('#', '')
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  function onContactSubmit(event) {
    event.preventDefault()
    if (!contactName.trim() || !contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setContactFeedback('Please fill in your name, email, subject, and message.')
      return
    }

    const subject = `Mathelaureate inquiry: ${contactSubject.trim()}`
    const body = [
      `Name: ${contactName.trim()}`,
      `Email: ${contactEmail.trim()}`,
      `Subject: ${contactSubject.trim()}`,
      '',
      contactMessage.trim(),
    ].join('\n')

    window.location.href = `mailto:mathelaureate@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setContactFeedback('Opening your email app with a pre-filled message.')
  }

  return (
    <main className="site home-site">
      <SiteHeader user={user} cachedProfile={cachedProfile} />

      <section className="hero-section">
        <div className="hero-content">
          <p className="eyebrow">IBDP | IGCSE | IBMYP</p>
          <h1>Excellence in International Mathematics Education</h1>
          <p className="hero-copy">
            Learn with clarity, score with confidence. Curated resources, assessments and support classes aligned to
            international curricula.
          </p>
          <div className="hero-actions">
            <Link to="/programs" className="btn primary">
              Explore Programs
            </Link>
            <a href="#contact" className="btn ghost">
              Contact Us
            </a>
          </div>
        </div>
      </section>

      <section id="programs" className="panel-section">
        <h2>Programs We Offer</h2>
        <ProgramCards withLinks />
      </section>

      <section id="testimonials" className="panel-section testimonials-shell">
        <p className="eyebrow testimonials-eyebrow">Student Voices</p>
        <h2 className="testimonials-title">What Our Students Say</h2>
        <div className="testimonial-grid modern-testimonial-grid">
          <article className="testimonial-card">
            <div className="testimonial-stars">★★★★★</div>
            <blockquote>
              “Mathelaureate&apos;s IBDP AA resources helped me fully grasp calculus. The step-by-step proofs and
              visual explanations made everything click.”
            </blockquote>
            <div className="testimonial-person">
              <span className="testimonial-avatar">AS</span>
              <div>
                <strong>Ananya S.</strong>
                <small>IBDP Year 2 · Singapore</small>
              </div>
            </div>
          </article>
          <article className="testimonial-card">
            <div className="testimonial-stars">★★★★★</div>
            <blockquote>
              “The IGCSE practice sets were exactly what I needed. Clear, concise, and exam-style questions that were
              incredibly well-targeted.”
            </blockquote>
            <div className="testimonial-person">
              <span className="testimonial-avatar">RK</span>
              <div>
                <strong>Rayan K.</strong>
                <small>IGCSE · Dubai</small>
              </div>
            </div>
          </article>
          <article className="testimonial-card">
            <div className="testimonial-stars">★★★★★</div>
            <blockquote>
              “As a parent, I appreciate how curriculum-specific Mathelaureate is. My daughter moved from a 4 to a 6
              in IBMYP Maths within one semester.”
            </blockquote>
            <div className="testimonial-person">
              <span className="testimonial-avatar">PM</span>
              <div>
                <strong>Priya M.</strong>
                <small>Parent · Bengaluru</small>
              </div>
            </div>
          </article>
        </div>
      </section>

      <footer id="contact" className="panel-section">
        <div className="contact-intro">
          <p className="eyebrow">Get In Touch</p>
          <h2>Contact Us</h2>
          <p>Have questions about our programs? Send us a message and we&apos;ll get back to you within 24 hours.</p>
        </div>
        <form className="contact-form contact-form-card" onSubmit={onContactSubmit}>
          <div className="contact-grid-two">
            <input
              type="text"
              placeholder="Full Name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email Address"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              required
            />
          </div>
          <select value={contactSubject} onChange={(event) => setContactSubject(event.target.value)} required>
            <option value="General inquiry">General inquiry</option>
            <option value="Program guidance">Program guidance</option>
            <option value="Pricing and access">Pricing and access</option>
            <option value="Technical support">Technical support</option>
          </select>
          <textarea
            rows={4}
            placeholder="Your message"
            value={contactMessage}
            onChange={(event) => setContactMessage(event.target.value)}
            required
          />
          <div className="contact-actions-row">
            <button type="submit" className="btn primary" id="login">
              Send Message
            </button>
            <small>We&apos;ll respond within 24 hours.</small>
          </div>
          {contactFeedback ? <p className="success-text">{contactFeedback}</p> : null}
        </form>
      </footer>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <h3>
              Mathe<span>laureate</span>
            </h3>
            <p>
              Excellence in International Mathematics Education - empowering IB and IGCSE students to achieve their full
              mathematical potential.
            </p>
          </div>
          <div className="home-footer-column">
            <h4>About</h4>
            <a href="/#home">Our Mission</a>
            <Link to="/teachers-resources">Teachers &amp; Resources</Link>
            <a href="/events">Events</a>
          </div>
          <div className="home-footer-column">
            <h4>Programs</h4>
            <a href="/#programs">IBDP Mathematics</a>
            <a href="/#programs">IBMYP Mathematics</a>
            <a href="/#programs">IGCSE Mathematics</a>
          </div>
          <div className="home-footer-column">
            <h4>Contact</h4>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-use">Terms of Use</Link>
          </div>
        </div>
        <div className="home-footer-bottom">
          <small>&copy; 2026 Mathelaureate. All rights reserved.</small>
          <div className="home-footer-legal">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-use">Terms</Link>
            <a href="/#contact">Accessibility</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function ProgramCards({ withLinks = false }) {
  const navigate = useNavigate()

  function onCourseClick(slug) {
    navigate(`/courses/${slug}`)
  }

  return (
    <div className="program-grid">
      {courseCatalog.map((course) =>
        withLinks ? (
          <button className="course-card-link" key={course.slug} type="button" onClick={() => onCourseClick(course.slug)}>
            <article>
              <h3>{course.title}</h3>
              <p>{course.description}</p>
            </article>
          </button>
        ) : (
          <article key={course.slug}>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
          </article>
        ),
      )}
    </div>
  )
}

function ProgramsPage({ user, cachedProfile }) {
  return (
    <main className="site">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="panel-section">
        <h1>Programs</h1>
        <p>Browse all curriculum tracks and choose the one aligned to your school pathway.</p>
        <ProgramCards withLinks />
      </section>
    </main>
  )
}

function EventsPage({ user, cachedProfile }) {
  const [events, setEvents] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState('')

  useEffect(() => {
    let active = true

    async function loadEvents() {
      setLoadingEvents(true)
      setEventsError('')
      try {
        const eventsSnap = await getDoc(eventsDocRef)
        const items = normalizeEvents(eventsSnap.data()?.items)
        if (!active) return
        setEvents(items)
      } catch (error) {
        if (!active) return
        setEventsError(error?.message || 'Unable to load events.')
      } finally {
        if (active) setLoadingEvents(false)
      }
    }

    loadEvents()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="site">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="panel-section">
        <h1>Events</h1>
        <p>Upcoming workshops, bootcamps, and revision sessions.</p>
        {loadingEvents ? <p>Loading events...</p> : null}
        {eventsError ? <p className="error-text">{eventsError}</p> : null}
        {!loadingEvents && events.length === 0 ? <p>No upcoming events yet.</p> : null}
        <div className="events-grid">
          {events.map((event) => (
            <article key={event.id}>
              {event.imageUrl ? <img src={event.imageUrl} alt={event.title} /> : null}
              <small>{event.date}</small>
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              {event.link ? (
                <a href={event.link} target="_blank" rel="noreferrer">
                  Open event link
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function TeachersResourcesPage({ user, cachedProfile }) {
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [postsError, setPostsError] = useState('')

  useEffect(() => {
    let active = true

    async function loadPosts() {
      setLoadingPosts(true)
      setPostsError('')
      try {
        const postsSnap = await getDoc(teachersResourcesDocRef)
        const items = normalizeTeachersResourcesPosts(postsSnap.data()?.items)
        if (!active) return
        setPosts(items)
      } catch (error) {
        if (!active) return
        setPostsError(error?.message || 'Unable to load teachers resources right now.')
      } finally {
        if (active) setLoadingPosts(false)
      }
    }

    loadPosts()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="site">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="panel-section">
        <h1>Teachers &amp; Resources</h1>
        <p>Updates, curated links, and classroom-ready materials shared as resource posts.</p>
        {loadingPosts ? <p>Loading resources...</p> : null}
        {postsError ? <p className="error-text">{postsError}</p> : null}
        {!loadingPosts && posts.length === 0 ? <p>No resource posts yet.</p> : null}
        <div className="resource-posts-grid">
          {posts.map((post) => (
            <article key={post.id} className="resource-post-card">
              {post.imageUrl ? (
                <div className="resource-post-image">
                  <img src={post.imageUrl} alt={post.title} />
                </div>
              ) : null}
              <div className="resource-post-body">
                <h3>{post.title}</h3>
                <p>{post.description}</p>
                {post.link ? (
                  <a href={post.link} target="_blank" rel="noreferrer">
                    Open resource
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function PrivacyPolicyPage({ user, cachedProfile }) {
  return (
    <main className="site">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="panel-section">
        <h1>Privacy Policy</h1>
        <p>
          Mathelaureate is an international mathematics learning platform focused on IBDP, IGCSE, and IBMYP programs.
          This Privacy Policy explains how we collect, use, store, and protect information when you use our website
          and services.
        </p>
        <h2>Information We Collect</h2>
        <p>
          We may collect account data (name, email, profile image), learning activity and progress data, payment
          metadata for paid courses, and messages sent through contact forms. We also collect technical diagnostics
          needed to improve reliability and security.
        </p>
        <h2>How We Use Data</h2>
        <p>
          We use information to deliver course access, personalize learning experience, process payments, provide
          support, maintain platform performance, and communicate important product or policy updates.
        </p>
        <h2>Data Storage and Security</h2>
        <p>
          Mathelaureate uses trusted cloud providers for authentication, storage, and payment workflows. We apply
          reasonable safeguards to protect user data from unauthorized access, disclosure, or misuse.
        </p>
        <h2>Data Sharing</h2>
        <p>
          We do not sell personal information. Data may be shared with essential service providers only when needed to
          run the platform (for example, hosting, media storage, and payment processing), or where required by law.
        </p>
        <h2>Student and Parent Rights</h2>
        <p>
          Parents or guardians may request access, correction, or deletion of student-linked information where
          applicable. Users may also request account or data updates through our contact channels.
        </p>
        <h2>Policy Updates</h2>
        <p>
          We may update this policy periodically. Continued use of the platform after an update means you accept the
          revised Privacy Policy.
        </p>
      </section>
    </main>
  )
}

function TermsOfUsePage({ user, cachedProfile }) {
  return (
    <main className="site">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="panel-section">
        <h1>Terms of Use</h1>
        <p>
          By accessing Mathelaureate, you agree to these Terms of Use. If you do not agree, please do not use the
          website or related services.
        </p>
        <h2>Service Scope</h2>
        <p>
          Mathelaureate provides mathematics learning resources, assessments, and support content for academic
          preparation. Content is for educational use and should be used responsibly alongside formal school guidance.
        </p>
        <h2>Accounts and Access</h2>
        <p>
          You are responsible for activities performed under your account and for maintaining login confidentiality.
          Access to some lessons or units may depend on subscription or payment status.
        </p>
        <h2>Payments</h2>
        <p>
          Paid features, if applicable, are governed by the pricing and lock settings visible on the platform at the
          time of purchase. Payment transactions are processed through third-party providers.
        </p>
        <h2>Intellectual Property</h2>
        <p>
          All educational content, branding, and platform materials are owned by Mathelaureate or its licensors. You
          may not copy, republish, distribute, or commercially use content without written authorization.
        </p>
        <h2>Acceptable Use</h2>
        <p>
          Users must not attempt unauthorized access, abuse platform functionality, disrupt service, upload harmful
          content, or violate applicable laws while using the website.
        </p>
        <h2>Third-Party Services</h2>
        <p>
          The platform may link to third-party services and resources. Mathelaureate is not responsible for third-party
          content, availability, or independent policies.
        </p>
        <h2>Limitation of Liability</h2>
        <p>
          Services are provided on an &quot;as is&quot; basis. While we aim for high quality and uptime, we cannot guarantee
          uninterrupted access. To the extent permitted by law, Mathelaureate is not liable for indirect or
          consequential damages.
        </p>
        <h2>Updates to Terms</h2>
        <p>
          These terms may be updated from time to time. Continued use after updates indicates acceptance of the revised
          Terms of Use.
        </p>
      </section>
    </main>
  )
}

function CoursePage({ user, authReady, cachedProfile }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const course = courseCatalog.find((item) => item.slug === slug)
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [curriculum, setCurriculum] = useState(null)
  const [courseItems, setCourseItems] = useState([])
  const [courseLoading, setCourseLoading] = useState(false)
  const [courseError, setCourseError] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [selectedSubunit, setSelectedSubunit] = useState('')
  const [activeTab, setActiveTab] = useState('lesson')
  const [selectedDifficulties, setSelectedDifficulties] = useState([])
  const [activeSolutionItem, setActiveSolutionItem] = useState(null)
  const [paywallConfig, setPaywallConfig] = useState(() => normalizePaywallConfig())
  const [paidCourses, setPaidCourses] = useState({})
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [shareFeedback, setShareFeedback] = useState('')
  const [expandedImageUrl, setExpandedImageUrl] = useState('')

  if (!course) {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    let active = true

    async function loadCourseWorkspace() {
      if (!user || !course.curriculumId) return
      setCourseLoading(true)
      setCourseError('')

      try {
        const curriculaSnap = await getDoc(curriculaDocRef)
        const courses = ensureRequiredCurricula(curriculaSnap.data()?.courses)
        const matchedCurriculum = courses.find((item) => item.id === course.curriculumId) || null

        const recordsSnap = await getDocs(contentItemsCollectionRef)
        const filteredItems = recordsSnap.docs
          .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }))
          .filter((item) => item.curriculumId === course.curriculumId)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

        const paywallSnap = await getDoc(paywallDocRef)
        const nextPaywallConfig = normalizePaywallConfig(paywallSnap.data())
        const paymentSnap = await getDoc(doc(db, 'userPayments', user.uid))
        const nextPaidCourses = paymentSnap.exists() ? paymentSnap.data()?.courses || {} : {}

        const progressRef = doc(db, 'userCourseProgress', user.uid)
        const progressSnap = await getDoc(progressRef)
        const lastViewedCourse = progressSnap.exists() ? progressSnap.data()?.courses?.[course.slug] : null

        function hasSubunit(unitId, subunitName) {
          if (!matchedCurriculum || !unitId || !subunitName) return false
          const unit = matchedCurriculum.units?.find((item) => item.id === unitId)
          return Array.isArray(unit?.subunits) && unit.subunits.includes(subunitName)
        }

        const firstUnit = matchedCurriculum?.units?.[0]
        const firstSubunit = firstUnit?.subunits?.[0] ?? ''
        let nextUnitId = firstUnit?.id ?? ''
        let nextSubunit = firstSubunit
        let nextTab = 'lesson'

        const searchParams = new URLSearchParams(location.search || '')
        const requestedUnitId = searchParams.get('unit') || ''
        const requestedSubunit = searchParams.get('subunit') || ''
        const requestedTab = searchParams.get('tab') === 'question' ? 'question' : 'lesson'

        if (hasSubunit(requestedUnitId, requestedSubunit)) {
          nextUnitId = requestedUnitId
          nextSubunit = requestedSubunit
          nextTab = requestedTab
        } else if (hasSubunit(lastViewedCourse?.lastViewedUnitId, lastViewedCourse?.lastViewedSubunit)) {
          nextUnitId = lastViewedCourse.lastViewedUnitId
          nextSubunit = lastViewedCourse.lastViewedSubunit
        } else {
          const firstContentMatch = filteredItems.find((item) => hasSubunit(item.unitId, item.subunit))
          if (firstContentMatch) {
            nextUnitId = firstContentMatch.unitId
            nextSubunit = firstContentMatch.subunit
          }
        }

        if (!active) return

        setCurriculum(matchedCurriculum)
        setCourseItems(filteredItems)
        setPaywallConfig(nextPaywallConfig)
        setPaidCourses(nextPaidCourses)
        setSelectedUnitId(nextUnitId)
        setSelectedSubunit(nextSubunit)
        setActiveTab(nextTab)
      } catch (error) {
        if (!active) return
        setCourseError(error?.message || 'Unable to load lessons from Firestore.')
      } finally {
        if (active) setCourseLoading(false)
      }
    }

    loadCourseWorkspace()

    return () => {
      active = false
    }
  }, [user, course.curriculumId, location.search])

  async function startGoogleLogin() {
    setLoginPending(true)
    setLoginError('')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      const message = error?.message?.replace('Firebase: ', '') || 'Unable to complete Google sign-in.'
      setLoginError(message)
    } finally {
      setLoginPending(false)
    }
  }

  const units = curriculum?.units ?? []
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) || units[0]
  const currentSubunit = selectedSubunit || selectedUnit?.subunits?.[0] || ''
  const scopedItems = courseItems.filter((item) => item.unitId === selectedUnit?.id && item.subunit === currentSubunit)
  const sortByStoredOrder = (a, b) => {
    const aOrder = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER
    const bOrder = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''))
  }
  const lessons = [...scopedItems.filter((item) => item.itemType === 'lesson' || item.itemType === 'resource')].sort(sortByStoredOrder)
  const questions = scopedItems.filter((item) => item.itemType === 'question')
  const difficultyOptions = ['easy', 'medium', 'hard']
  const difficultyRank = { easy: 1, medium: 2, hard: 3 }
  const filteredQuestions = [...(selectedDifficulties.length === 0
    ? questions
    : questions.filter((item) => selectedDifficulties.includes(String(item.difficulty || '').toLowerCase())))].sort((a, b) => {
    const aRank = difficultyRank[String(a?.difficulty || 'medium').toLowerCase()] || 99
    const bRank = difficultyRank[String(b?.difficulty || 'medium').toLowerCase()] || 99
    if (aRank !== bRank) return aRank - bRank
    return sortByStoredOrder(a, b)
  })
  const activeItems = activeTab === 'lesson' ? lessons : filteredQuestions
  const lessonShareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/courses/${course.slug}?unit=${encodeURIComponent(selectedUnit?.id || '')}&subunit=${encodeURIComponent(currentSubunit || '')}&tab=${encodeURIComponent(activeTab)}`
      : ''
  const paidForCurrentCourse = Boolean(paidCourses?.[course.curriculumId]?.paid)
  const coursePrice = Number(paywallConfig.coursePrices?.[course.curriculumId] || 0)
  const lockedUnits = paywallConfig.lockedUnits?.[course.curriculumId] || []
  const lockedSubunits = paywallConfig.lockedSubunits?.[course.curriculumId] || []
  const currentSubunitLockKey = `${selectedUnit?.id}::${currentSubunit}`
  const isCurrentSelectionLocked =
    !paidForCurrentCourse &&
    (lockedUnits.includes(selectedUnit?.id) || lockedSubunits.includes(currentSubunitLockKey))

  function isUnitLocked(unitId) {
    return !paidForCurrentCourse && lockedUnits.includes(unitId)
  }

  function isSubunitLocked(unitId, subunitName) {
    const lockKey = `${unitId}::${subunitName}`
    return !paidForCurrentCourse && (lockedUnits.includes(unitId) || lockedSubunits.includes(lockKey))
  }

  function openSolution(item, index) {
    setActiveSolutionItem({
      ...item,
      questionNumber: index + 1,
    })
  }

  function closeSolution() {
    setActiveSolutionItem(null)
  }

  async function nativeShareLesson() {
    if (!lessonShareUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${course.title} - ${currentSubunit || selectedUnit?.name || 'Lesson'}`,
          text: 'Check out this lesson on Mathelaureate.',
          url: lessonShareUrl,
        })
        setShareFeedback('Lesson shared.')
      } catch {
        // User cancel is non-fatal.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(lessonShareUrl)
      setShareFeedback('Lesson link copied.')
    } catch {
      setShareFeedback('Unable to copy link.')
    }
  }

  async function startCoursePurchase() {
    setPaymentError('')
    if (!user || !course.curriculumId) return
    if (!coursePrice || coursePrice <= 0) {
      setPaymentError('Pricing is not configured for this course yet.')
      return
    }

    setPaymentBusy(true)
    const scriptReady = await ensureRazorpayLoaded()
    if (!scriptReady) {
      setPaymentBusy(false)
      setPaymentError('Unable to load Razorpay checkout. Please try again.')
      return
    }

    let orderPayload = null
    const countryCodeHint = (await detectUserCountryCode()) || 'IN'
    let idToken = ''

    try {
      idToken = await user.getIdToken()
    } catch {
      setPaymentBusy(false)
      setPaymentError('Unable to verify your login session. Please sign in again.')
      return
    }

    try {
      const createOrderResponse = await fetch(`${paymentApiBaseUrl}/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId: course.curriculumId,
          courseSlug: course.slug,
          courseTitle: course.title,
          countryCodeHint,
        }),
      })
      const createOrderPayload = await createOrderResponse.json().catch(() => ({}))
      if (!createOrderResponse.ok) {
        throw new Error(createOrderPayload?.error || 'Unable to create payment order.')
      }
      orderPayload = createOrderPayload
    } catch (error) {
      setPaymentBusy(false)
      setPaymentError(error?.message || 'Unable to create payment order.')
      return
    }
    if (!orderPayload?.keyId || !orderPayload?.orderId) {
      setPaymentBusy(false)
      setPaymentError('Payment configuration is incomplete. Please contact support.')
      return
    }

    const options = {
      key: orderPayload?.keyId || '',
      amount: Number(orderPayload?.amount || 0),
      currency: orderPayload?.currency || 'INR',
      order_id: orderPayload?.orderId,
      name: 'Mathelaureate',
      description: `${course.title} course access`,
      prefill: {
        name: user.displayName || '',
        email: user.email || '',
      },
      handler: async function onPaymentSuccess(response) {
        try {
          const verifyResponse = await fetch(`${paymentApiBaseUrl}/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              courseId: course.curriculumId,
              courseSlug: course.slug,
              courseTitle: course.title,
              razorpay_order_id: response?.razorpay_order_id || '',
              razorpay_payment_id: response?.razorpay_payment_id || '',
              razorpay_signature: response?.razorpay_signature || '',
            }),
          })
          if (!verifyResponse.ok) {
            const verifyPayload = await verifyResponse.json().catch(() => ({}))
            throw new Error(verifyPayload?.error || 'Payment verification failed.')
          }

          const paymentSnap = await getDoc(doc(db, 'userPayments', user.uid))
          const nextPaidCourses = paymentSnap.exists() ? paymentSnap.data()?.courses || {} : {}
          setPaidCourses(nextPaidCourses)
          setPaymentError('')
        } catch (error) {
          setPaymentError(error?.message || 'Payment verification failed.')
        } finally {
          setPaymentBusy(false)
        }
      },
      modal: {
        ondismiss: () => setPaymentBusy(false),
      },
      theme: {
        color: '#6f42c1',
      },
    }

    const instance = new window.Razorpay(options)
    instance.on('payment.failed', () => {
      setPaymentError('Payment was not completed. Please try again.')
      setPaymentBusy(false)
    })
    instance.open()
  }

  function toggleDifficultyFilter(level) {
    setSelectedDifficulties((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
    )
  }

  useEffect(() => {
    setShareFeedback('')
  }, [selectedUnit?.id, currentSubunit, activeTab])

  useEffect(() => {
    let active = true

    async function trackUserCourseProgress() {
      if (!user || !course.curriculumId || !selectedUnit?.id || !currentSubunit) return

      try {
        const progressRef = doc(db, 'userCourseProgress', user.uid)
        const progressSnap = await getDoc(progressRef)
        const existingData = progressSnap.exists() ? progressSnap.data() : {}
        const existingCourses = existingData?.courses || {}
        const existingCourse = existingCourses[course.slug] || {}
        const subunitKey = `${selectedUnit.id}::${currentSubunit}`
        const visitedSubunits = Array.isArray(existingCourse.visitedSubunits) ? existingCourse.visitedSubunits : []

        if (visitedSubunits.includes(subunitKey) || !active) return

        const updatedVisitedSubunits = [...visitedSubunits, subunitKey]
        const timestamp = new Date().toISOString()
        const updatedCourse = {
          ...existingCourse,
          slug: course.slug,
          title: course.title,
          curriculumId: course.curriculumId,
          visitedSubunits: updatedVisitedSubunits,
          visitedSubunitsCount: updatedVisitedSubunits.length,
          lastViewedUnitId: selectedUnit.id,
          lastViewedSubunit: currentSubunit,
          updatedAt: timestamp,
        }
        const updatedCourses = {
          ...existingCourses,
          [course.slug]: updatedCourse,
        }
        const updatedMyCourses = Object.values(updatedCourses)
          .filter((courseEntry) => Number(courseEntry?.visitedSubunitsCount || 0) > 1)
          .map((courseEntry) => ({
            slug: courseEntry.slug,
            title: courseEntry.title,
            curriculumId: courseEntry.curriculumId,
            visitedSubunitsCount: courseEntry.visitedSubunitsCount,
            updatedAt: courseEntry.updatedAt || timestamp,
          }))

        await setDoc(
          progressRef,
          {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            courses: updatedCourses,
            myCourses: updatedMyCourses,
            updatedAt: timestamp,
          },
          { merge: true },
        )
      } catch {
        // Non-blocking: progress tracking should never break page access.
      }
    }

    trackUserCourseProgress()

    return () => {
      active = false
    }
  }, [user, course.slug, course.title, course.curriculumId, selectedUnit?.id, currentSubunit])

  if (!authReady) {
    return (
      <main className="site">
        <section className="panel-section auth-card">
          <h2>Checking authentication...</h2>
          <p>One moment while we verify your login status.</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="site">
        <section className="panel-section auth-card auth-status-card">
          <h2>Sign in required</h2>
          <p>Use your Google account to continue to this course.</p>
          {loginError ? <p>{loginError}</p> : null}
          <button type="button" className="btn primary google-btn" onClick={startGoogleLogin} disabled={loginPending}>
            {loginPending ? 'Signing in...' : 'Continue with Google'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="site course-page">
      <SiteHeader user={user} cachedProfile={cachedProfile} bare />
      <section className="course-shell-fluid course-workspace">
        <div className="course-head course-workspace-head">
          <div>
            <p className="eyebrow">{course.title} · Course</p>
            <h1>{selectedUnit?.name || course.title}</h1>
            <p>{course.description}</p>
        </div>
          <div className="course-head-actions">
            <button type="button" className="btn ghost" onClick={() => navigate('/#programs')}>
              Back to Programs
            </button>
          </div>
        </div>

        {courseLoading ? <p>Loading lesson workspace...</p> : null}
        {courseError ? <p className="error-text">{courseError}</p> : null}

        {!course.curriculumId ? (
          <section className="course-basic">
            <h2>Curriculum Workspace Coming Soon</h2>
            <p>This course is available publicly, and its subunit lesson workspace will be added next.</p>
          </section>
        ) : (
          <div className="course-workspace-grid">
            <aside className="lesson-sidebar">
              {units.map((unit) => (
                <div className="sidebar-unit" key={unit.id}>
                  <button
                    type="button"
                    className={`sidebar-unit-btn ${selectedUnit?.id === unit.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedUnitId(unit.id)
                      setSelectedSubunit(unit.subunits?.[0] || '')
                    }}
                  >
                    <span>{unit.name}</span>
                    {isUnitLocked(unit.id) ? <small className="lock-badge">Locked</small> : null}
                  </button>
                  {selectedUnit?.id === unit.id ? (
                    <div className="sidebar-subunits">
                      {(unit.subunits || []).map((subtopic) => (
                        <button
                          type="button"
                          key={subtopic}
                          className={`sidebar-subunit-btn ${
                            selectedUnit?.id === unit.id && currentSubunit === subtopic ? 'active' : ''
                          }`}
                          onClick={() => {
                            setSelectedUnitId(unit.id)
                            setSelectedSubunit(subtopic)
                          }}
                        >
                          <span>{subtopic}</span>
                          {isSubunitLocked(unit.id, subtopic) ? <small className="lock-badge">Locked</small> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </aside>

            <section className={`lesson-main ${activeTab === 'lesson' ? 'lesson-main-centered' : ''}`}>
              <p className="eyebrow">{currentSubunit || 'Subunit'}</p>
              <h2>{activeTab === 'lesson' ? 'Lesson' : 'Question Bank'}</h2>
              <div className="lesson-toolbar">
                <div className="lesson-tabs">
                  <button
                    type="button"
                    className={`lesson-tab ${activeTab === 'lesson' ? 'active' : ''}`}
                    onClick={() => setActiveTab('lesson')}
                  >
                    Lesson
                  </button>
                  <button
                    type="button"
                    className={`lesson-tab ${activeTab === 'question' ? 'active' : ''}`}
                    onClick={() => setActiveTab('question')}
                  >
                    Question Bank
                  </button>
                </div>
                <button
                  type="button"
                  className="icon-share-btn"
                  onClick={nativeShareLesson}
                  title="Share lesson"
                  aria-label="Share lesson"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                    <path d="M12 16V4" />
                    <path d="M7 9l5-5 5 5" />
                  </svg>
                </button>
              </div>
              {shareFeedback ? (
                <div className="lesson-share-row">
                  <small>{shareFeedback}</small>
                </div>
              ) : null}

              {isCurrentSelectionLocked ? (
                <article className="lesson-card paywall-card">
                  <h3>Premium Content</h3>
                  <p>This unit/subunit is locked. Purchase this course to unlock all premium sections.</p>
                  {coursePrice > 0 ? <p className="paywall-price">INR {coursePrice}</p> : <p>Price not configured yet.</p>}
                  {paymentError ? <p className="error-text">{paymentError}</p> : null}
                  <button type="button" className="btn primary" onClick={startCoursePurchase} disabled={paymentBusy || coursePrice <= 0}>
                    {paymentBusy ? 'Opening Checkout...' : 'Unlock with Razorpay'}
                  </button>
                </article>
              ) : (
                <>
                  {activeTab === 'question' ? (
                    <div className="question-filter-row">
                      <strong>Filter by difficulty</strong>
                      <div className="difficulty-chip-row">
                        <button
                          type="button"
                          className={`difficulty-chip ${selectedDifficulties.length === 0 ? 'active' : ''}`}
                          onClick={() => setSelectedDifficulties([])}
                        >
                          All
                        </button>
                        {difficultyOptions.map((level) => (
                          <button
                            type="button"
                            key={level}
                            className={`difficulty-chip ${selectedDifficulties.includes(level) ? 'active' : ''}`}
                            onClick={() => toggleDifficultyFilter(level)}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="lesson-content">
                    {activeItems.length === 0 ? (
                      <article className="lesson-card">
                        <h3>No content yet</h3>
                        <p>Use the admin dashboard to add {activeTab}s for this subunit.</p>
                      </article>
                    ) : (
                      activeItems.map((item, index) => (
                        <article
                          className={`lesson-card ${activeTab === 'lesson' ? 'lesson-card-lesson' : ''} ${
                            activeTab === 'question' ? 'lesson-card-question' : ''
                          }`}
                          key={item.id}
                        >
                          {activeTab !== 'question' ? (
                            <div className="record-top">
                              <span className="pill">{item.itemType}</span>
                            </div>
                          ) : null}
                          {activeTab === 'question' ? (
                            <h3 className="question-number-title">Question {index + 1}</h3>
                          ) : (
                            <LatexText value={item.title} className="latex-heading" />
                          )}
                          {activeTab === 'question' ? (
                            <div className="question-meta-row">
                              <span className="meta-chip">{String(item.gdc || 'Not GDC').toUpperCase()}</span>
                              <span className="meta-chip">{item.marks || 0} marks</span>
                              <span className={`meta-chip difficulty-${String(item.difficulty || 'medium').toLowerCase()}`}>
                                {String(item.difficulty || 'medium')}
                              </span>
                            </div>
                          ) : null}
                          <LatexText value={item.description} className="latex-text" />
                          {item.imageUrl ? (
                            <div className="content-image-block">
                              <button
                                type="button"
                                className="image-open-btn"
                                onClick={() => setExpandedImageUrl(item.imageUrl)}
                                aria-label="Open image in full view"
                              >
                                <img src={item.imageUrl} alt="Lesson visual" />
                              </button>
                            </div>
                          ) : null}
                          {activeTab === 'question' && (item.solution || item.solutionVideoLink || item.solutionImageUrl) ? (
                            <button type="button" className="btn ghost text-btn" onClick={() => openSolution(item, index)}>
                              View Solution
                            </button>
                          ) : null}
                          {item.resourceLink ? (
                            <a href={item.resourceLink} target="_blank" rel="noreferrer">
                              Open link
                            </a>
                          ) : null}
                          {activeTab === 'lesson' && item.geogebraLink ? (
                            <div className="geogebra-block">
                              <strong>Interactive Graph</strong>
                              <iframe
                                title={`geogebra-${item.id}`}
                                src={toGeoGebraEmbedUrl(item.geogebraLink)}
                                loading="lazy"
                                allowFullScreen
                              />
                              <a
                                className="btn ghost geogebra-open-btn"
                                href={toGeoGebraOpenUrl(item.geogebraLink)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open in GeoGebra
                              </a>
                            </div>
                          ) : null}
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </section>
      {activeSolutionItem ? (
        <section className="solution-modal-overlay" role="dialog" aria-modal="true" onClick={closeSolution}>
          <article className="solution-modal" onClick={(event) => event.stopPropagation()}>
            <div className="solution-modal-head">
              <h3>Solution</h3>
              <button type="button" className="icon-back-btn" onClick={closeSolution} aria-label="Close solution popup">
                ×
              </button>
            </div>
            <h4 className="question-number-title">Question {activeSolutionItem.questionNumber || ''}</h4>
            {activeSolutionItem.solution ? (
              <div className="solution-box">
                <LatexText value={activeSolutionItem.solution} className="latex-text" />
              </div>
            ) : null}
            {activeSolutionItem.solutionImageUrl ? (
              <div className="content-image-block">
                <button
                  type="button"
                  className="image-open-btn"
                  onClick={() => setExpandedImageUrl(activeSolutionItem.solutionImageUrl)}
                  aria-label="Open solution image in full view"
                >
                  <img src={activeSolutionItem.solutionImageUrl} alt="Solution visual" />
                </button>
              </div>
            ) : null}
            {activeSolutionItem.solutionVideoLink && toYouTubeEmbedUrl(activeSolutionItem.solutionVideoLink) ? (
              <div className="solution-video-wrap">
                <h4>Video Solution</h4>
                <iframe
                  title={`video-solution-${activeSolutionItem.id || activeSolutionItem.questionNumber || 'question'}`}
                  src={toYouTubeEmbedUrl(activeSolutionItem.solutionVideoLink)}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : null}
          </article>
        </section>
      ) : null}
      {expandedImageUrl ? (
        <section className="image-zoom-overlay" role="dialog" aria-modal="true" onClick={() => setExpandedImageUrl('')}>
          <article className="image-zoom-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="icon-back-btn image-zoom-close" onClick={() => setExpandedImageUrl('')} aria-label="Close image view">
              ×
            </button>
            <img src={expandedImageUrl} alt="Expanded content" />
          </article>
        </section>
      ) : null}
    </main>
  )
}

function ProfilePage({ user, cachedProfile }) {
  const [myCourses, setMyCourses] = useState([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)

  useEffect(() => {
    let active = true

    async function loadMyCourses() {
      if (!user) return
      setIsLoadingCourses(true)

      try {
        const progressRef = doc(db, 'userCourseProgress', user.uid)
        const progressSnap = await getDoc(progressRef)
        if (!progressSnap.exists()) {
          if (active) setMyCourses([])
          return
        }

        const data = progressSnap.data() || {}
        const persistedMyCourses = Array.isArray(data.myCourses) ? data.myCourses : []
        const fallbackComputedCourses = Object.values(data.courses || {}).filter(
          (courseEntry) => Number(courseEntry?.visitedSubunitsCount || 0) > 1,
        )
        const resolvedCourses = (persistedMyCourses.length > 0 ? persistedMyCourses : fallbackComputedCourses).sort((a, b) =>
          String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || '')),
        )

        if (active) setMyCourses(resolvedCourses)
      } catch {
        if (active) setMyCourses([])
      } finally {
        if (active) setIsLoadingCourses(false)
      }
    }

    loadMyCourses()

    return () => {
      active = false
    }
  }, [user])

  if (!user) {
    return <Navigate to="/" replace />
  }

  const profileInitial =
    user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || cachedProfile?.email?.[0]?.toUpperCase() || 'S'
  const profileName = user.displayName || cachedProfile?.displayName || user.email?.split('@')[0] || 'Student'

  return (
    <main className="site profile-page">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="profile-card">
        <div className="profile-card-left">
          <div className="profile-avatar">{profileInitial}</div>
          <div>
            <small>Your Profile</small>
            <h1>{profileName}</h1>
            <p>{user.email}</p>
          </div>
        </div>
        <button className="btn ghost" type="button" onClick={() => signOut(auth)}>
          Logout
        </button>
      </section>

      <section className="profile-section">
        <h2>My Courses</h2>
        {isLoadingCourses ? (
          <p>Loading your courses...</p>
        ) : myCourses.length === 0 ? (
          <p>No active courses found. Browse here.</p>
        ) : (
          <div className="my-courses-grid">
            {myCourses.map((courseEntry) => (
              <article className="my-course-card" key={`${courseEntry.slug}-${courseEntry.updatedAt || ''}`}>
                <h3>{courseEntry.title || courseEntry.slug}</h3>
                <p>{courseEntry.visitedSubunitsCount || 0} subunits covered</p>
                <Link className="btn primary" to={`/courses/${courseEntry.slug}`}>
                  Continue Course
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="profile-section">
        <h2>Quick Links</h2>
        <div className="quick-links-grid">
          <article className="quick-link-card">
            <h3>Explore Catalog</h3>
            <p>Discover new tracks and masterclasses.</p>
            <Link className="btn ghost" to="/#programs">
              Browse Courses
            </Link>
          </article>
          <article className="quick-link-card">
            <h3>Practice Papers</h3>
            <p>Access your curated question papers.</p>
            <Link className="btn ghost" to="/events">
              View Events
            </Link>
          </article>
        </div>
      </section>
    </main>
  )
}

function AdminPasscodeGate({ setUnlocked }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const isAdminPasscodeConfigured = Boolean(adminPasscode)

  function unlock() {
    if (!isAdminPasscodeConfigured) {
      setError('Admin passcode is not configured. Add VITE_ADMIN_PASSCODE in .env.local.')
      return
    }
    if (passcode === adminPasscode) {
      sessionStorage.setItem(adminPasscodeKey, 'true')
      setUnlocked(true)
      setError('')
      return
    }
    setError('Incorrect passcode.')
  }

  return (
    <section className="panel passcode-card">
      <h2>Admin Passcode</h2>
      <p>Enter passcode to open dashboard controls.</p>
      <input
        type="password"
        placeholder="Admin passcode"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
      />
      {!isAdminPasscodeConfigured ? <p className="error-text">Admin passcode is not configured.</p> : null}
      {error && <p className="error-text">{error}</p>}
      <button className="btn primary" type="button" onClick={unlock} disabled={!isAdminPasscodeConfigured}>
        Unlock Admin
      </button>
    </section>
  )
}

function ProtectedAdmin() {
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(() => sessionStorage.getItem(adminPasscodeKey) === 'true')

  if (!passcodeUnlocked) {
    return (
      <main className="admin">
        <AdminPasscodeGate setUnlocked={setPasscodeUnlocked} />
      </main>
    )
  }

  return <AdminPage />
}

function AdminPage() {
  const [curricula, setCurricula] = useState(defaultCurricula)
  const [records, setRecords] = useState([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [curriculumId, setCurriculumId] = useState(curricula[0]?.id ?? '')
  const [unitId, setUnitId] = useState(curricula[0]?.units[0]?.id ?? '')
  const [subunit, setSubunit] = useState(curricula[0]?.units[0]?.subunits[0] ?? '')
  const [itemType, setItemType] = useState('lesson')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [solution, setSolution] = useState('')
  const [solutionVideoLink, setSolutionVideoLink] = useState('')
  const [questionDifficulty, setQuestionDifficulty] = useState('medium')
  const [questionMarks, setQuestionMarks] = useState(1)
  const [questionGdc, setQuestionGdc] = useState('not gdc')
  const [geogebraLink, setGeogebraLink] = useState('')
  const [resourceLink, setResourceLink] = useState('')
  const [attachedFileName, setAttachedFileName] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')
  const [solutionImageFile, setSolutionImageFile] = useState(null)
  const [solutionImagePreviewUrl, setSolutionImagePreviewUrl] = useState('')
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [bulkQuestionInput, setBulkQuestionInput] = useState('')
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [bulkUploadError, setBulkUploadError] = useState('')
  const [bulkUploadSuccess, setBulkUploadSuccess] = useState('')
  const [paywallConfig, setPaywallConfig] = useState(() => normalizePaywallConfig())
  const [paywallCourseId, setPaywallCourseId] = useState(defaultCurricula[0]?.id ?? '')
  const [paywallUnitId, setPaywallUnitId] = useState(defaultCurricula[0]?.units?.[0]?.id ?? '')
  const [paywallSubunit, setPaywallSubunit] = useState(defaultCurricula[0]?.units?.[0]?.subunits?.[0] ?? '')
  const [paywallPriceInput, setPaywallPriceInput] = useState('')
  const [isPaywallSaving, setIsPaywallSaving] = useState(false)
  const [events, setEvents] = useState([])
  const [teachersResourcesPosts, setTeachersResourcesPosts] = useState([])
  const [adminSelection, setAdminSelection] = useState(curricula[0]?.id ?? '')
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventLink, setEventLink] = useState('')
  const [eventImageFile, setEventImageFile] = useState(null)
  const [eventImagePreviewUrl, setEventImagePreviewUrl] = useState('')
  const [isEventSaving, setIsEventSaving] = useState(false)
  const [resourcePostTitle, setResourcePostTitle] = useState('')
  const [resourcePostDescription, setResourcePostDescription] = useState('')
  const [resourcePostLink, setResourcePostLink] = useState('')
  const [resourcePostImageFile, setResourcePostImageFile] = useState(null)
  const [resourcePostImagePreviewUrl, setResourcePostImagePreviewUrl] = useState('')
  const [isTeachersResourcesSaving, setIsTeachersResourcesSaving] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newSubtopicName, setNewSubtopicName] = useState('')
  const [dragTopicIndex, setDragTopicIndex] = useState(null)
  const [dragSubtopicIndex, setDragSubtopicIndex] = useState(null)
  const [isDeletingTopic, setIsDeletingTopic] = useState(false)
  const [isDeletingSubtopic, setIsDeletingSubtopic] = useState(false)
  const [storedItemsTab, setStoredItemsTab] = useState('lesson')
  const [dragRecordIndex, setDragRecordIndex] = useState(null)
  const [editingRecordId, setEditingRecordId] = useState('')
  const [editingRecordType, setEditingRecordType] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSolution, setEditSolution] = useState('')
  const [editSolutionVideoLink, setEditSolutionVideoLink] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('medium')
  const [editMarks, setEditMarks] = useState(1)
  const [editGdc, setEditGdc] = useState('not gdc')
  const [editGeogebraLink, setEditGeogebraLink] = useState('')
  const [editResourceLink, setEditResourceLink] = useState('')

  const selectedCurriculum = useMemo(
    () => curricula.find((curriculum) => curriculum.id === curriculumId) ?? curricula[0],
    [curricula, curriculumId],
  )
  const isEventsManagementSelected = adminSelection === adminEventsOptionId
  const isTeachersResourcesSelected = adminSelection === adminTeachersResourcesOptionId
  const selectedUnit = useMemo(
    () => selectedCurriculum?.units.find((unit) => unit.id === unitId) ?? selectedCurriculum?.units[0],
    [selectedCurriculum, unitId],
  )
  const paywallCourse = useMemo(
    () => curricula.find((curriculum) => curriculum.id === paywallCourseId) ?? curricula[0],
    [curricula, paywallCourseId],
  )
  const paywallUnit = useMemo(
    () => paywallCourse?.units.find((unit) => unit.id === paywallUnitId) ?? paywallCourse?.units[0],
    [paywallCourse, paywallUnitId],
  )
  const scopedRecords = records.filter(
    (item) => item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit,
  )
  const sortByStoredOrder = (a, b) => {
    const aOrder = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER
    const bOrder = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''))
  }
  const scopedLessons = [...scopedRecords.filter((item) => item.itemType === 'lesson')].sort(sortByStoredOrder)
  const scopedQuestions = [...scopedRecords.filter((item) => item.itemType === 'question')].sort(sortByStoredOrder)
  const activeStoredRecords = storedItemsTab === 'lesson' ? scopedLessons : scopedQuestions

  useEffect(() => {
    setEditingRecordId('')
    setEditingRecordType('')
    setEditTitle('')
    setEditDescription('')
    setEditSolution('')
    setEditSolutionVideoLink('')
    setEditDifficulty('medium')
    setEditMarks(1)
    setEditGdc('not gdc')
    setEditGeogebraLink('')
    setEditResourceLink('')
    setDragRecordIndex(null)
  }, [curriculumId, unitId, subunit, storedItemsTab])

  function parseSubunitOrder(label) {
    const match = String(label).match(/(?:^|\s)(\d+)\.(\d+)\b/)
    if (!match) return null
    return { major: Number(match[1]), minor: Number(match[2]) }
  }

  function sortSubunitsInNumericOrder(subunits) {
    return [...subunits]
      .map((label, index) => ({ label, index, order: parseSubunitOrder(label) }))
      .sort((a, b) => {
        if (a.order && b.order) {
          if (a.order.major !== b.order.major) return a.order.major - b.order.major
          if (a.order.minor !== b.order.minor) return a.order.minor - b.order.minor
          return a.index - b.index
        }
        if (a.order && !b.order) return -1
        if (!a.order && b.order) return 1
        return a.index - b.index
      })
      .map((item) => item.label)
  }

  function normalizeCurriculaOrdering(nextCurricula) {
    return nextCurricula.map((curriculum) => ({
      ...curriculum,
      units: (curriculum.units || []).map((unit) => ({
        ...unit,
        subunits: sortSubunitsInNumericOrder(unit.subunits || []),
      })),
    }))
  }

  useEffect(() => {
    let active = true

    async function loadAdminData() {
      setIsDataLoading(true)
      setDataError('')
      try {
        const curriculaSnap = await getDoc(curriculaDocRef)
        let courses = defaultCurricula

        if (curriculaSnap.exists()) {
          const savedCourses = curriculaSnap.data()?.courses
          courses = ensureRequiredCurricula(savedCourses)
          if (JSON.stringify(savedCourses || []) !== JSON.stringify(courses)) {
            await setDoc(curriculaDocRef, { courses })
          }
        } else {
          await setDoc(curriculaDocRef, { courses: defaultCurricula })
        }

        const recordsSnap = await getDocs(contentItemsCollectionRef)
        const fetchedRecords = recordsSnap.docs
          .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        const paywallSnap = await getDoc(paywallDocRef)
        const nextPaywallConfig = normalizePaywallConfig(paywallSnap.data())
        const eventsSnap = await getDoc(eventsDocRef)
        const nextEvents = normalizeEvents(eventsSnap.data()?.items)
        const teachersResourcesSnap = await getDoc(teachersResourcesDocRef)
        const nextTeachersResourcesPosts = normalizeTeachersResourcesPosts(teachersResourcesSnap.data()?.items)

        if (!active) return
        setCurricula(courses)
        setRecords(fetchedRecords)
        setEvents(nextEvents)
        setTeachersResourcesPosts(nextTeachersResourcesPosts)
        setCurriculumId(courses[0]?.id ?? '')
        setAdminSelection(courses[0]?.id ?? '')
        setUnitId(courses[0]?.units[0]?.id ?? '')
        setSubunit(courses[0]?.units[0]?.subunits[0] ?? '')
        setPaywallConfig(nextPaywallConfig)
        const initialCourseId = courses[0]?.id ?? ''
        const initialUnit = courses[0]?.units?.[0]
        setPaywallCourseId(initialCourseId)
        setPaywallUnitId(initialUnit?.id ?? '')
        setPaywallSubunit(initialUnit?.subunits?.[0] ?? '')
        setPaywallPriceInput(String(nextPaywallConfig.coursePrices?.[initialCourseId] || ''))
      } catch (error) {
        if (!active) return
        setDataError(error?.message || 'Unable to load data from Firestore.')
      } finally {
        if (active) setIsDataLoading(false)
      }
    }

    loadAdminData()

    return () => {
      active = false
    }
  }, [])

  async function persistCurricula(updated) {
    const normalized = normalizeCurriculaOrdering(updated)
    setCurricula(normalized)
    await setDoc(curriculaDocRef, { courses: normalized })
  }

  function persistRecords(updated) {
    setRecords(updated)
  }

  async function persistPaywall(nextConfig) {
    setIsPaywallSaving(true)
    setPaywallConfig(nextConfig)
    try {
      await setDoc(paywallDocRef, nextConfig, { merge: true })
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save paywall settings.')
    } finally {
      setIsPaywallSaving(false)
    }
  }

  async function persistEvents(nextEvents) {
    const normalized = normalizeEvents(nextEvents)
    setEvents(normalized)
    setIsEventSaving(true)
    try {
      await setDoc(eventsDocRef, { items: normalized }, { merge: true })
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save events.')
    } finally {
      setIsEventSaving(false)
    }
  }

  async function persistTeachersResourcesPosts(nextPosts) {
    const normalized = normalizeTeachersResourcesPosts(nextPosts)
    setTeachersResourcesPosts(normalized)
    setIsTeachersResourcesSaving(true)
    try {
      await setDoc(teachersResourcesDocRef, { items: normalized }, { merge: true })
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save teachers resources.')
    } finally {
      setIsTeachersResourcesSaving(false)
    }
  }

  function onPaywallCourseChange(nextId) {
    const nextCourse = curricula.find((curriculum) => curriculum.id === nextId)
    const firstUnit = nextCourse?.units?.[0]
    setPaywallCourseId(nextId)
    setPaywallUnitId(firstUnit?.id ?? '')
    setPaywallSubunit(firstUnit?.subunits?.[0] ?? '')
    setPaywallPriceInput(String(paywallConfig.coursePrices?.[nextId] || ''))
  }

  function onPaywallUnitChange(nextId) {
    const nextUnit = paywallCourse?.units?.find((unit) => unit.id === nextId)
    setPaywallUnitId(nextId)
    setPaywallSubunit(nextUnit?.subunits?.[0] ?? '')
  }

  async function saveCoursePrice() {
    const nextPrice = Number(paywallPriceInput || 0)
    const nextConfig = {
      ...paywallConfig,
      coursePrices: {
        ...paywallConfig.coursePrices,
        [paywallCourseId]: nextPrice,
      },
    }
    await persistPaywall(nextConfig)
  }

  async function toggleUnitLock() {
    const current = paywallConfig.lockedUnits?.[paywallCourseId] || []
    const nextSet = current.includes(paywallUnitId)
      ? current.filter((id) => id !== paywallUnitId)
      : [...current, paywallUnitId]
    const nextConfig = {
      ...paywallConfig,
      lockedUnits: {
        ...paywallConfig.lockedUnits,
        [paywallCourseId]: nextSet,
      },
    }
    await persistPaywall(nextConfig)
  }

  async function toggleSubunitLock() {
    const key = `${paywallUnitId}::${paywallSubunit}`
    const current = paywallConfig.lockedSubunits?.[paywallCourseId] || []
    const nextSet = current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    const nextConfig = {
      ...paywallConfig,
      lockedSubunits: {
        ...paywallConfig.lockedSubunits,
        [paywallCourseId]: nextSet,
      },
    }
    await persistPaywall(nextConfig)
  }

  function onCurriculumChange(nextId) {
    if (nextId === adminEventsOptionId || nextId === adminTeachersResourcesOptionId) {
      setAdminSelection(nextId)
      return
    }
    const nextCurriculum = curricula.find((curriculum) => curriculum.id === nextId)
    const firstUnit = nextCurriculum?.units[0]
    setAdminSelection(nextId)
    setCurriculumId(nextId)
    setUnitId(firstUnit?.id ?? '')
    setSubunit(firstUnit?.subunits[0] ?? '')
  }

  function onUnitChange(nextId) {
    const nextUnit = selectedCurriculum?.units.find((unit) => unit.id === nextId)
    setUnitId(nextId)
    setSubunit(nextUnit?.subunits[0] ?? '')
  }

  function addTopic(event) {
    event.preventDefault()
    if (!newTopicName.trim()) return

    const newUnit = {
      id: `unit-${Date.now()}`,
      name: newTopicName.trim(),
      subunits: [],
    }
    const updated = curricula.map((curriculum) =>
      curriculum.id === curriculumId ? { ...curriculum, units: [...curriculum.units, newUnit] } : curriculum,
    )
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to save topic changes.'))
    setUnitId(newUnit.id)
    setSubunit('')
    setNewTopicName('')
  }

  function addSubtopic(event) {
    event.preventDefault()
    if (!newSubtopicName.trim() || !selectedUnit) return

    const label = newSubtopicName.trim()
    const updated = curricula.map((curriculum) => {
      if (curriculum.id !== curriculumId) return curriculum
      return {
        ...curriculum,
        units: curriculum.units.map((unit) =>
          unit.id === unitId ? { ...unit, subunits: sortSubunitsInNumericOrder([...unit.subunits, label]) } : unit,
        ),
      }
    })
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to save subtopic changes.'))
    setSubunit(label)
    setNewSubtopicName('')
  }

  function reorderTopics(targetIndex) {
    if (dragTopicIndex === null || dragTopicIndex === targetIndex) return
    const updated = curricula.map((curriculum) => {
      if (curriculum.id !== curriculumId) return curriculum
      return {
        ...curriculum,
        units: moveItem(curriculum.units, dragTopicIndex, targetIndex),
      }
    })
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to reorder topics.'))
    setDragTopicIndex(null)
  }

  function reorderSubtopics(targetIndex) {
    if (dragSubtopicIndex === null || dragSubtopicIndex === targetIndex || !selectedUnit) return
    const updated = curricula.map((curriculum) => {
      if (curriculum.id !== curriculumId) return curriculum
      return {
        ...curriculum,
        units: curriculum.units.map((unit) => {
          if (unit.id !== unitId) return unit
          return {
            ...unit,
            subunits: moveItem(unit.subunits, dragSubtopicIndex, targetIndex),
          }
        }),
      }
    })
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to reorder subtopics.'))
    setDragSubtopicIndex(null)
  }

  async function deleteSelectedTopic() {
    if (!selectedCurriculum || !unitId) return
    const units = selectedCurriculum.units || []
    if (units.length <= 1) {
      setDataError('At least one topic must remain in a course.')
      return
    }
    const unitToDelete = units.find((unit) => unit.id === unitId)
    if (!unitToDelete) return
    const confirmed = window.confirm(
      `Delete topic "${unitToDelete.name}" and all its subtopics/content items? This cannot be undone.`,
    )
    if (!confirmed) return

    setIsDeletingTopic(true)
    setDataError('')
    try {
      const updatedCurricula = curricula.map((curriculum) => {
        if (curriculum.id !== curriculumId) return curriculum
        return {
          ...curriculum,
          units: curriculum.units.filter((unit) => unit.id !== unitId),
        }
      })
      await persistCurricula(updatedCurricula)

      const nextCurriculum = updatedCurricula.find((curriculum) => curriculum.id === curriculumId)
      const fallbackUnit = nextCurriculum?.units?.[0]
      const fallbackSubunit = fallbackUnit?.subunits?.[0] || ''
      setUnitId(fallbackUnit?.id || '')
      setSubunit(fallbackSubunit)

      const nextLockedUnits = (paywallConfig.lockedUnits?.[curriculumId] || []).filter((lockedUnitId) => lockedUnitId !== unitId)
      const unitPrefix = `${unitId}::`
      const nextLockedSubunits = (paywallConfig.lockedSubunits?.[curriculumId] || []).filter(
        (lockKey) => !String(lockKey).startsWith(unitPrefix),
      )
      const nextPaywallConfig = {
        ...paywallConfig,
        lockedUnits: {
          ...paywallConfig.lockedUnits,
          [curriculumId]: nextLockedUnits,
        },
        lockedSubunits: {
          ...paywallConfig.lockedSubunits,
          [curriculumId]: nextLockedSubunits,
        },
      }
      await persistPaywall(nextPaywallConfig)

      if (paywallCourseId === curriculumId) {
        setPaywallUnitId(fallbackUnit?.id || '')
        setPaywallSubunit(fallbackSubunit)
      }

      const recordsToDelete = records.filter((item) => item.curriculumId === curriculumId && item.unitId === unitId)
      await Promise.all(recordsToDelete.map((item) => deleteDoc(doc(db, 'courseContentItems', item.id))))
      persistRecords(records.filter((item) => !(item.curriculumId === curriculumId && item.unitId === unitId)))
    } catch (error) {
      setDataError(error?.message || 'Unable to delete topic.')
    } finally {
      setIsDeletingTopic(false)
    }
  }

  async function deleteSelectedSubtopic() {
    if (!selectedCurriculum || !selectedUnit || !subunit) return
    const subunits = selectedUnit.subunits || []
    if (subunits.length <= 1) {
      setDataError('At least one subtopic must remain in a topic.')
      return
    }
    const confirmed = window.confirm(
      `Delete subtopic "${subunit}" and all its content items? This cannot be undone.`,
    )
    if (!confirmed) return

    setIsDeletingSubtopic(true)
    setDataError('')
    try {
      const updatedCurricula = curricula.map((curriculum) => {
        if (curriculum.id !== curriculumId) return curriculum
        return {
          ...curriculum,
          units: curriculum.units.map((unit) =>
            unit.id === unitId ? { ...unit, subunits: unit.subunits.filter((name) => name !== subunit) } : unit,
          ),
        }
      })
      await persistCurricula(updatedCurricula)

      const nextUnit = updatedCurricula.find((curriculum) => curriculum.id === curriculumId)?.units.find((unit) => unit.id === unitId)
      const fallbackSubunit = nextUnit?.subunits?.[0] || ''
      setSubunit(fallbackSubunit)

      const deleteSubunitKey = `${unitId}::${subunit}`
      const nextLockedSubunits = (paywallConfig.lockedSubunits?.[curriculumId] || []).filter(
        (lockKey) => lockKey !== deleteSubunitKey,
      )
      const nextPaywallConfig = {
        ...paywallConfig,
        lockedSubunits: {
          ...paywallConfig.lockedSubunits,
          [curriculumId]: nextLockedSubunits,
        },
      }
      await persistPaywall(nextPaywallConfig)

      if (paywallCourseId === curriculumId && paywallUnitId === unitId && paywallSubunit === subunit) {
        setPaywallSubunit(fallbackSubunit)
      }

      const recordsToDelete = records.filter(
        (item) => item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit,
      )
      await Promise.all(recordsToDelete.map((item) => deleteDoc(doc(db, 'courseContentItems', item.id))))
      persistRecords(records.filter((item) => !(item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit)))
    } catch (error) {
      setDataError(error?.message || 'Unable to delete subtopic.')
    } finally {
      setIsDeletingSubtopic(false)
    }
  }

  function onImageFileChange(event) {
    const file = event.target.files?.[0] || null
    setSelectedImageFile(file)
    setAttachedFileName(file?.name || '')
    setSelectedImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  function onSolutionImageFileChange(event) {
    const file = event.target.files?.[0] || null
    setSolutionImageFile(file)
    setSolutionImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  async function submitItem(event) {
    event.preventDefault()
    if (
      itemType === 'question' &&
      !String(solution || '').trim() &&
      !String(solutionVideoLink || '').trim() &&
      !solutionImageFile
    ) {
      setDataError('Add a text solution, solution image, or a YouTube video solution link for question items.')
      return
    }
    let imageUrl = ''
    let imagePath = ''
    let solutionImageUrl = ''
    let solutionImagePath = ''

    if (selectedImageFile) {
      if (!supabaseConfigured) {
        setDataError('Supabase not configured. Add Supabase env values before uploading images.')
        return
      }
      try {
        setIsImageUploading(true)
        const uploadResult = await uploadImageToSupabase(selectedImageFile, `${curriculumId}/${unitId}`)
        imageUrl = uploadResult.publicUrl
        imagePath = uploadResult.path
      } catch (error) {
        setIsImageUploading(false)
        setDataError(error?.message || 'Unable to upload image to Supabase.')
        return
      }
    }
    if (itemType === 'question' && solutionImageFile) {
      if (!supabaseConfigured) {
        setDataError('Supabase not configured. Add Supabase env values before uploading images.')
        setIsImageUploading(false)
        return
      }
      try {
        setIsImageUploading(true)
        const uploadResult = await uploadImageToSupabase(solutionImageFile, `${curriculumId}/${unitId}/solutions`)
        solutionImageUrl = uploadResult.publicUrl
        solutionImagePath = uploadResult.path
      } catch (error) {
        setIsImageUploading(false)
        setDataError(error?.message || 'Unable to upload solution image to Supabase.')
        return
      }
    }

    const sameScopeSameTypeRecords = records.filter(
      (item) =>
        item.curriculumId === curriculumId &&
        item.unitId === unitId &&
        item.subunit === subunit &&
        item.itemType === itemType,
    )
    const maxSortOrder = sameScopeSameTypeRecords.reduce((max, item) => {
      const value = Number(item?.sortOrder)
      return Number.isFinite(value) ? Math.max(max, value) : max
    }, 0)

    const newRecord = {
      itemType,
      title: itemType === 'question' ? '' : title,
      description,
      solution: itemType === 'question' ? solution : '',
      solutionVideoLink: itemType === 'question' ? solutionVideoLink.trim() : '',
      solutionImageUrl: itemType === 'question' ? solutionImageUrl : '',
      solutionImagePath: itemType === 'question' ? solutionImagePath : '',
      difficulty: itemType === 'question' ? questionDifficulty : '',
      marks: itemType === 'question' ? Number(questionMarks || 0) : 0,
      gdc: itemType === 'question' ? questionGdc : '',
      geogebraLink: itemType === 'lesson' ? geogebraLink : '',
      resourceLink,
      attachedFileName,
      imageUrl,
      imagePath,
      curriculumId,
      unitId,
      subunit,
      sortOrder: maxSortOrder + 1,
      createdAt: new Date().toISOString(),
    }
    try {
      const docRef = await addDoc(contentItemsCollectionRef, newRecord)
      persistRecords([{ id: docRef.id, ...newRecord }, ...records])
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save content item.')
    }
    setIsImageUploading(false)
    setTitle('')
    setDescription('')
    setSolution('')
    setSolutionVideoLink('')
    setQuestionDifficulty('medium')
    setQuestionMarks(1)
    setQuestionGdc('not gdc')
    setGeogebraLink('')
    setResourceLink('')
    setAttachedFileName('')
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    setSolutionImageFile(null)
    setSolutionImagePreviewUrl('')
  }

  async function submitBulkQuestions(event) {
    event.preventDefault()
    setDataError('')
    setBulkUploadError('')
    setBulkUploadSuccess('')
    setIsBulkUploading(true)

    try {
      const rawInput = String(bulkQuestionInput || '').trim()
      if (!rawInput) throw new Error('Paste JSON first.')

      const fencedMatch = rawInput.match(/```(?:json)?\s*([\s\S]*?)```/i)
      const jsonSource = fencedMatch?.[1]?.trim() || rawInput
      const parsed = JSON.parse(jsonSource)
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
          ? parsed.questions
          : parsed && typeof parsed === 'object'
            ? [parsed]
            : null
      if (!items || items.length === 0) {
        throw new Error('Provide a question JSON object, array, or { "questions": [...] }.')
      }
      if (!curriculumId || !unitId || !subunit) {
        throw new Error('Select course, topic, and subtopic before bulk upload.')
      }

      const existingQuestionRecords = records.filter(
        (item) =>
          item.curriculumId === curriculumId &&
          item.unitId === unitId &&
          item.subunit === subunit &&
          item.itemType === 'question',
      )
      const baseSortOrder = existingQuestionRecords.reduce((max, item) => {
        const value = Number(item?.sortOrder)
        return Number.isFinite(value) ? Math.max(max, value) : max
      }, 0)

      const created = []
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index] || {}
        const descriptionValue = String(item.description || item.question || item.prompt || '').trim()
        if (!descriptionValue) {
          throw new Error(`Question ${index + 1} is missing description/question text.`)
        }

        const newRecord = {
          itemType: 'question',
          title: '',
          description: descriptionValue,
          solution: String(item.solution || '').trim(),
          solutionVideoLink: String(item.solutionVideoLink || item.videoSolutionLink || item.youtubeLink || '').trim(),
          solutionImageUrl: String(item.solutionImageUrl || '').trim(),
          solutionImagePath: '',
          difficulty: String(item.difficulty || 'medium').toLowerCase(),
          marks: Math.max(1, Number(item.marks || 1)),
          gdc: String(item.gdc || 'not gdc').toLowerCase() === 'gdc' ? 'gdc' : 'not gdc',
          geogebraLink: '',
          resourceLink: String(item.resourceLink || '').trim(),
          attachedFileName: '',
          imageUrl: '',
          imagePath: '',
          curriculumId,
          unitId,
          subunit,
          sortOrder: baseSortOrder + index + 1,
          createdAt: new Date(Date.now() + index).toISOString(),
        }

        const docRef = await addDoc(contentItemsCollectionRef, newRecord)
        created.push({ id: docRef.id, ...newRecord })
      }

      persistRecords([...created, ...records])
      setBulkQuestionInput('')
      setBulkUploadSuccess(`Uploaded ${created.length} question${created.length === 1 ? '' : 's'} successfully.`)
    } catch (error) {
      setDataError(error?.message || 'Unable to parse/upload bulk questions.')
      setBulkUploadError(error?.message || 'Unable to parse/upload bulk questions.')
    } finally {
      setIsBulkUploading(false)
    }
  }

  async function removeRecord(id) {
    try {
      await deleteDoc(doc(db, 'courseContentItems', id))
      persistRecords(records.filter((item) => item.id !== id))
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to delete content item.')
    }
  }

  function beginEditRecord(record) {
    setEditingRecordId(record.id)
    setEditingRecordType(record.itemType)
    setEditTitle(String(record.title || ''))
    setEditDescription(String(record.description || ''))
    setEditSolution(String(record.solution || ''))
    setEditSolutionVideoLink(String(record.solutionVideoLink || ''))
    setEditDifficulty(String(record.difficulty || 'medium'))
    setEditMarks(Number(record.marks || 1))
    setEditGdc(String(record.gdc || 'not gdc'))
    setEditGeogebraLink(String(record.geogebraLink || ''))
    setEditResourceLink(String(record.resourceLink || ''))
  }

  function cancelEditRecord() {
    setEditingRecordId('')
    setEditingRecordType('')
    setEditTitle('')
    setEditDescription('')
    setEditSolution('')
    setEditSolutionVideoLink('')
    setEditDifficulty('medium')
    setEditMarks(1)
    setEditGdc('not gdc')
    setEditGeogebraLink('')
    setEditResourceLink('')
  }

  async function saveRecordEdits() {
    if (!editingRecordId || !editingRecordType) return
    const editingRecord = records.find((item) => item.id === editingRecordId) || null
    if (editingRecordType !== 'question' && !editTitle.trim()) {
      setDataError('Title is required for lessons.')
      return
    }
    if (!editDescription.trim()) {
      setDataError('Description is required.')
      return
    }
    if (
      editingRecordType === 'question' &&
      !editSolution.trim() &&
      !editSolutionVideoLink.trim() &&
      !String(editingRecord?.solutionImageUrl || '').trim()
    ) {
      setDataError('Add either a text solution, solution image, or a YouTube video solution link.')
      return
    }

    const payload =
      editingRecordType === 'question'
        ? {
            description: editDescription.trim(),
            solution: editSolution.trim(),
            solutionVideoLink: editSolutionVideoLink.trim(),
            difficulty: editDifficulty,
            marks: Math.max(1, Number(editMarks || 1)),
            gdc: editGdc,
            resourceLink: editResourceLink.trim(),
            updatedAt: new Date().toISOString(),
          }
        : {
            title: editTitle.trim(),
            description: editDescription.trim(),
            geogebraLink: editGeogebraLink.trim(),
            resourceLink: editResourceLink.trim(),
            updatedAt: new Date().toISOString(),
          }

    try {
      await setDoc(doc(db, 'courseContentItems', editingRecordId), payload, { merge: true })
      persistRecords(records.map((item) => (item.id === editingRecordId ? { ...item, ...payload } : item)))
      setDataError('')
      cancelEditRecord()
    } catch (error) {
      setDataError(error?.message || 'Unable to save item edits.')
    }
  }

  async function reorderStoredItems(targetIndex) {
    if (dragRecordIndex === null || dragRecordIndex === targetIndex) return
    const reordered = moveItem(activeStoredRecords, dragRecordIndex, targetIndex)
    const reorderedWithOrder = reordered.map((item, index) => ({ ...item, sortOrder: index + 1 }))
    const orderById = new Map(reorderedWithOrder.map((item) => [item.id, item.sortOrder]))
    const updatedRecords = records.map((item) =>
      orderById.has(item.id) ? { ...item, sortOrder: orderById.get(item.id) } : item,
    )

    persistRecords(updatedRecords)
    setDragRecordIndex(null)
    try {
      await Promise.all(
        reorderedWithOrder.map((item) =>
          setDoc(doc(db, 'courseContentItems', item.id), { sortOrder: item.sortOrder }, { merge: true }),
        ),
      )
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to reorder stored items.')
    }
  }

  async function submitEvent(event) {
    event.preventDefault()
    if (!eventTitle.trim() || !eventDate) return
    let imageUrl = ''
    let imagePath = ''
    if (eventImageFile) {
      if (!supabaseConfigured) {
        setDataError('Supabase not configured. Add Supabase env values before uploading images.')
        return
      }
      try {
        setIsEventSaving(true)
        const uploadResult = await uploadImageToSupabase(eventImageFile, 'events')
        imageUrl = uploadResult.publicUrl
        imagePath = uploadResult.path
      } catch (error) {
        setIsEventSaving(false)
        setDataError(error?.message || 'Unable to upload event image to Supabase.')
        return
      }
    }
    const next = [
      ...events,
      {
        id: `event-${Date.now()}`,
        title: eventTitle.trim(),
        date: eventDate,
        description: eventDescription.trim(),
        link: eventLink.trim(),
        imageUrl,
        imagePath,
      },
    ]
    await persistEvents(next)
    setEventTitle('')
    setEventDate('')
    setEventDescription('')
    setEventLink('')
    setEventImageFile(null)
    setEventImagePreviewUrl('')
  }

  async function removeEvent(eventId) {
    await persistEvents(events.filter((item) => item.id !== eventId))
  }

  function onResourcePostImageChange(event) {
    const file = event.target.files?.[0] || null
    setResourcePostImageFile(file)
    setResourcePostImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  function onEventImageChange(event) {
    const file = event.target.files?.[0] || null
    setEventImageFile(file)
    setEventImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  async function submitTeachersResourcePost(event) {
    event.preventDefault()
    if (!resourcePostTitle.trim() || !resourcePostDescription.trim()) return

    let imageUrl = ''
    let imagePath = ''
    if (resourcePostImageFile) {
      if (!supabaseConfigured) {
        setDataError('Supabase not configured. Add Supabase env values before uploading images.')
        return
      }
      try {
        setIsTeachersResourcesSaving(true)
        const uploadResult = await uploadImageToSupabase(resourcePostImageFile, 'teachers-resources')
        imageUrl = uploadResult.publicUrl
        imagePath = uploadResult.path
      } catch (error) {
        setIsTeachersResourcesSaving(false)
        setDataError(error?.message || 'Unable to upload image to Supabase.')
        return
      }
    }

    const nextPosts = [
      {
        id: `tr-${Date.now()}`,
        title: resourcePostTitle.trim(),
        description: resourcePostDescription.trim(),
        link: resourcePostLink.trim(),
        imageUrl,
        imagePath,
        createdAt: new Date().toISOString(),
      },
      ...teachersResourcesPosts,
    ]
    await persistTeachersResourcesPosts(nextPosts)
    setResourcePostTitle('')
    setResourcePostDescription('')
    setResourcePostLink('')
    setResourcePostImageFile(null)
    setResourcePostImagePreviewUrl('')
  }

  async function removeTeachersResourcePost(postId) {
    await persistTeachersResourcesPosts(teachersResourcesPosts.filter((item) => item.id !== postId))
  }

  const isUnitLockedInAdmin = (paywallConfig.lockedUnits?.[paywallCourseId] || []).includes(paywallUnitId)
  const selectedPaywallSubunitKey = `${paywallUnitId}::${paywallSubunit}`
  const isSubunitLockedInAdmin = (paywallConfig.lockedSubunits?.[paywallCourseId] || []).includes(selectedPaywallSubunitKey)

  return (
    <main className="admin">
      <header className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage course topics/subtopics and upload mapped lessons, questions, and resources.</p>
        </div>
        <Link className="btn ghost" to="/">
          Back to Website
        </Link>
      </header>
      {isDataLoading && <p>Loading course data...</p>}
      {dataError && <p className="error-text">{dataError}</p>}

      <section className="admin-grid">
        <aside className="panel">
          <h2>Course Structure</h2>
          <label>
            Course
            <select value={adminSelection} onChange={(event) => onCurriculumChange(event.target.value)}>
              <option value={adminEventsOptionId}>Events Management</option>
              <option value={adminTeachersResourcesOptionId}>Teachers &amp; Resources</option>
              {curricula.map((curriculum) => (
                <option value={curriculum.id} key={curriculum.id}>
                  {curriculum.name}
                </option>
              ))}
            </select>
          </label>
          {!isEventsManagementSelected && !isTeachersResourcesSelected ? (
            <>
          <label>
            Topic
            <select value={unitId} onChange={(event) => onUnitChange(event.target.value)}>
              {(selectedCurriculum?.units ?? []).map((unit) => (
                <option value={unit.id} key={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn danger" type="button" onClick={deleteSelectedTopic} disabled={isDeletingTopic || !(selectedCurriculum?.units?.length > 1)}>
            {isDeletingTopic ? 'Deleting topic...' : 'Delete Selected Topic'}
          </button>
          <label>
            Subtopic
            <select value={subunit} onChange={(event) => setSubunit(event.target.value)}>
              {(selectedUnit?.subunits ?? []).map((subunitName) => (
                <option value={subunitName} key={subunitName}>
                  {subunitName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn danger"
            type="button"
            onClick={deleteSelectedSubtopic}
            disabled={isDeletingSubtopic || !(selectedUnit?.subunits?.length > 1)}
          >
            {isDeletingSubtopic ? 'Deleting subtopic...' : 'Delete Selected Subtopic'}
          </button>

          <form onSubmit={addTopic}>
            <label>
              Add Topic
              <input
                value={newTopicName}
                onChange={(event) => setNewTopicName(event.target.value)}
                placeholder="New topic name"
              />
            </label>
            <button className="btn primary" type="submit">
              Add Topic
            </button>
          </form>

          <form onSubmit={addSubtopic}>
            <label>
              Add Subtopic
              <input
                value={newSubtopicName}
                onChange={(event) => setNewSubtopicName(event.target.value)}
                placeholder="New subtopic name"
              />
            </label>
            <button className="btn primary" type="submit">
              Add Subtopic
            </button>
          </form>

          <div className="dnd-block">
            <h3>Drag Topic Order</h3>
            <ul className="dnd-list">
              {(selectedCurriculum?.units ?? []).map((unit, index) => (
                <li
                  key={unit.id}
                  draggable
                  className="dnd-item"
                  onDragStart={() => setDragTopicIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderTopics(index)}
                >
                  {unit.name}
            </li>
              ))}
            </ul>
          </div>

          <div className="dnd-block">
            <h3>Drag Subtopic Order</h3>
            <ul className="dnd-list">
              {(selectedUnit?.subunits ?? []).map((subtopicLabel, index) => (
                <li
                  key={`${subtopicLabel}-${index}`}
                  draggable
                  className="dnd-item"
                  onDragStart={() => setDragSubtopicIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderSubtopics(index)}
                >
                  {subtopicLabel}
            </li>
              ))}
          </ul>
        </div>
            </>
          ) : (
            <p>Select a course to manage topics, subtopics, and content items.</p>
          )}
        </aside>

        <div className="stack">
          {isEventsManagementSelected ? (
          <section className="panel">
            <h2>Events Management</h2>
            <form onSubmit={submitEvent}>
              <label>
                Event Title
                <input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} required />
              </label>
              <label>
                Event Date
                <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={eventDescription}
                  onChange={(event) => setEventDescription(event.target.value)}
                  placeholder="Workshop details"
                />
              </label>
              <label>
                Event Link (optional)
                <input value={eventLink} onChange={(event) => setEventLink(event.target.value)} placeholder="https://..." />
              </label>
              <label>
                Event Image (optional)
                <input type="file" accept="image/*" onChange={onEventImageChange} />
              </label>
              {eventImagePreviewUrl ? (
                <div className="image-preview-block">
                  <img src={eventImagePreviewUrl} alt="Event preview" />
                </div>
              ) : null}
              <button className="btn primary" type="submit" disabled={isEventSaving}>
                {isEventSaving ? 'Saving event...' : 'Add Event'}
              </button>
            </form>
            <div className="records">
              {events.length === 0 ? (
                <p className="empty">No events added yet.</p>
              ) : (
                events.map((item) => (
                  <article key={item.id} className="record">
                    <div className="record-top">
                      <span className="pill">event</span>
                      <button type="button" onClick={() => removeEvent(item.id)}>
                        Delete
                      </button>
                    </div>
                    <h3>{item.title}</h3>
                    <small>{item.date}</small>
                    <p>{item.description}</p>
                    {item.imageUrl ? (
                      <div className="admin-record-image">
                        <img src={item.imageUrl} alt={item.title} />
                      </div>
                    ) : null}
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noreferrer">
                        Open event link
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
          ) : isTeachersResourcesSelected ? (
          <section className="panel">
            <h2>Teachers &amp; Resources Posts</h2>
            <form onSubmit={submitTeachersResourcePost}>
              <label>
                Post Title
                <input value={resourcePostTitle} onChange={(event) => setResourcePostTitle(event.target.value)} required />
              </label>
              <label>
                Description
                <textarea
                  rows={4}
                  value={resourcePostDescription}
                  onChange={(event) => setResourcePostDescription(event.target.value)}
                  placeholder="Add the post summary/content"
                  required
                />
              </label>
              <label>
                Resource Link (optional)
                <input
                  value={resourcePostLink}
                  onChange={(event) => setResourcePostLink(event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label>
                Image Upload (optional)
                <input type="file" accept="image/*" onChange={onResourcePostImageChange} />
              </label>
              {resourcePostImagePreviewUrl ? (
                <div className="image-preview-block">
                  <img src={resourcePostImagePreviewUrl} alt="Teachers resource post preview" />
                </div>
              ) : null}
              <button className="btn primary" type="submit" disabled={isTeachersResourcesSaving}>
                {isTeachersResourcesSaving ? 'Saving post...' : 'Publish Post'}
              </button>
            </form>
            <div className="records">
              {teachersResourcesPosts.length === 0 ? (
                <p className="empty">No posts published yet.</p>
              ) : (
                teachersResourcesPosts.map((item) => (
                  <article key={item.id} className="record">
                    <div className="record-top">
                      <span className="pill">resource post</span>
                      <button type="button" onClick={() => removeTeachersResourcePost(item.id)}>
                        Delete
                      </button>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {item.imageUrl ? (
                      <div className="admin-record-image">
                        <img src={item.imageUrl} alt={item.title} />
                      </div>
                    ) : null}
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noreferrer">
                        Open resource
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
          ) : (
          <>

          <section className="panel">
            <h2>Paywall Controls</h2>
            <label>
              Course
              <select value={paywallCourseId} onChange={(event) => onPaywallCourseChange(event.target.value)}>
                {curricula.map((curriculum) => (
                  <option key={curriculum.id} value={curriculum.id}>
                    {curriculum.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit
              <select value={paywallUnitId} onChange={(event) => onPaywallUnitChange(event.target.value)}>
                {(paywallCourse?.units || []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subunit
              <select value={paywallSubunit} onChange={(event) => setPaywallSubunit(event.target.value)}>
                {(paywallUnit?.subunits || []).map((subunitName) => (
                  <option key={subunitName} value={subunitName}>
                    {subunitName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Course Price (INR)
              <input
                type="number"
                min={0}
                value={paywallPriceInput}
                onChange={(event) => setPaywallPriceInput(event.target.value)}
              />
            </label>
            <div className="paywall-actions">
              <button type="button" className="btn primary" onClick={saveCoursePrice} disabled={isPaywallSaving}>
                {isPaywallSaving ? 'Saving...' : 'Save Course Price'}
              </button>
              <button type="button" className={`btn ${isUnitLockedInAdmin ? 'primary' : 'ghost'}`} onClick={toggleUnitLock}>
                {isUnitLockedInAdmin ? 'Unlock Unit' : 'Lock Unit'}
              </button>
              <button type="button" className={`btn ${isSubunitLockedInAdmin ? 'primary' : 'ghost'}`} onClick={toggleSubunitLock}>
                {isSubunitLockedInAdmin ? 'Unlock Subunit' : 'Lock Subunit'}
              </button>
            </div>
          </section>

          <form className="panel" onSubmit={submitItem}>
            <h2>Create Content Item</h2>
            <label>
              Item Type
              <select value={itemType} onChange={(event) => setItemType(event.target.value)}>
                <option value="lesson">Lesson</option>
                <option value="question">Question</option>
                <option value="resource">Resource</option>
              </select>
            </label>
            {itemType !== 'question' ? (
              <label>
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
            ) : null}
            <label>
              Description
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Prompt, explanation or resource details"
                required
              />
            </label>
            {itemType === 'question' ? (
              <>
                <label>
                  Difficulty
                  <select value={questionDifficulty} onChange={(event) => setQuestionDifficulty(event.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label>
                  Marks
                  <input
                    type="number"
                    min={1}
                    value={questionMarks}
                    onChange={(event) => setQuestionMarks(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Calculator Type
                  <select value={questionGdc} onChange={(event) => setQuestionGdc(event.target.value)}>
                    <option value="gdc">GDC</option>
                    <option value="not gdc">Not GDC</option>
                  </select>
                </label>
                <label>
                  Solution (supports LaTeX)
                  <textarea
                    rows={5}
                    value={solution}
                    onChange={(event) => setSolution(event.target.value)}
                    placeholder="Example: $$x^2 - 4 = 0 \\Rightarrow (x-2)(x+2)=0$$"
                  />
                </label>
                <label>
                  YouTube Video Solution Link (optional)
                  <input
                    value={solutionVideoLink}
                    onChange={(event) => setSolutionVideoLink(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </label>
                <label>
                  Solution Image Upload (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onSolutionImageFileChange}
                  />
                </label>
                {solutionImagePreviewUrl ? (
                  <div className="image-preview-block">
                    <img src={solutionImagePreviewUrl} alt="Question solution preview" />
                  </div>
                ) : null}
                <section className="latex-preview">
                  <h3>Live Preview</h3>
                  <article className="lesson-card">
                    <div className="record-top">
                      <span className="pill">question</span>
                    </div>
                    <div className="question-meta-row">
                      <span className="meta-chip">{questionGdc.toUpperCase()}</span>
                      <span className="meta-chip">{questionMarks} marks</span>
                      <span className="meta-chip">{questionDifficulty}</span>
                    </div>
                    <h3 className="question-number-title">Question Preview</h3>
                    <LatexText value={description || 'Question statement preview'} className="latex-text" />
                    <div className="solution-box">
                      <LatexText value={solution || 'Solution preview'} className="latex-text" />
                    </div>
                  </article>
                  <small>
                    Use <code>$...$</code> for inline math and <code>$$...$$</code> for block math.
                  </small>
                  {solutionVideoLink && toYouTubeEmbedUrl(solutionVideoLink) ? (
                    <div className="solution-video-wrap">
                      <h4>Video Solution Preview</h4>
                      <iframe
                        title="video-solution-preview"
                        src={toYouTubeEmbedUrl(solutionVideoLink)}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}
            {itemType === 'lesson' ? (
              <label>
                GeoGebra Link or Material ID (optional)
                <input
                  value={geogebraLink}
                  onChange={(event) => setGeogebraLink(event.target.value)}
                  placeholder="https://www.geogebra.org/m/abc123 or abc123"
                />
              </label>
            ) : null}
            <label>
              Resource Link (optional)
              <input
                value={resourceLink}
                onChange={(event) => setResourceLink(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label>
              Image Upload (Supabase, optional)
              <input
                type="file"
                accept="image/*"
                onChange={onImageFileChange}
              />
            </label>
            {selectedImagePreviewUrl ? (
              <div className="image-preview-block">
                <img src={selectedImagePreviewUrl} alt="Selected upload preview" />
                <small>{attachedFileName}</small>
              </div>
            ) : null}
            <button className="btn primary" type="submit" disabled={isImageUploading}>
              {isImageUploading ? 'Uploading image...' : 'Save Item'}
            </button>
          </form>

          <form className="panel" onSubmit={submitBulkQuestions}>
            <h2>Bulk Upload Questions</h2>
            <p>Paste ChatGPT JSON. Each item will be uploaded as an individual question card.</p>
            <label>
              Bulk JSON
              <textarea
                rows={12}
                value={bulkQuestionInput}
                onChange={(event) => setBulkQuestionInput(event.target.value)}
                placeholder='[{"description":"Question text", "solution":"...", "difficulty":"medium", "marks":5, "gdc":"gdc"}]'
                required
              />
            </label>
            {bulkUploadError ? <p className="error-text">{bulkUploadError}</p> : null}
            {bulkUploadSuccess ? <p className="success-text">{bulkUploadSuccess}</p> : null}
            <button className="btn primary" type="submit" disabled={isBulkUploading}>
              {isBulkUploading ? 'Uploading questions...' : 'Upload Questions'}
            </button>
          </form>

          <section className="panel">
            <h2>Stored Items ({activeStoredRecords.length})</h2>
            <div className="stored-items-tabs">
              <button
                type="button"
                className={`stored-tab ${storedItemsTab === 'lesson' ? 'active' : ''}`}
                onClick={() => {
                  setStoredItemsTab('lesson')
                  cancelEditRecord()
                  setDragRecordIndex(null)
                }}
              >
                Lessons ({scopedLessons.length})
              </button>
              <button
                type="button"
                className={`stored-tab ${storedItemsTab === 'question' ? 'active' : ''}`}
                onClick={() => {
                  setStoredItemsTab('question')
                  cancelEditRecord()
                  setDragRecordIndex(null)
                }}
              >
                Questions ({scopedQuestions.length})
              </button>
            </div>
            <div className="records">
              {activeStoredRecords.length === 0 ? (
                <p className="empty">No content uploaded yet.</p>
              ) : (
                activeStoredRecords.map((record, index) => {
                  return (
                    <article
                      className="record"
                      key={record.id}
                      draggable
                      onDragStart={() => setDragRecordIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reorderStoredItems(index)}
                      onDragEnd={() => setDragRecordIndex(null)}
                    >
                      <div className="record-top">
                        <span className="pill">{record.itemType}</span>
                        <div className="record-actions">
                          <button type="button" onClick={() => beginEditRecord(record)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => removeRecord(record.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                      <h3>{record.title || (record.itemType === 'question' ? 'Question' : 'Untitled')}</h3>
                      <p>{record.description}</p>
                      {record.itemType === 'question' ? (
                        <small>
                          {String(record.gdc || 'not gdc').toUpperCase()} · {record.marks || 0} marks ·{' '}
                          {String(record.difficulty || 'medium')}
                        </small>
                      ) : null}
                      {record.itemType === 'question' && record.solution ? <small>Solution added</small> : null}
                      {record.itemType === 'question' && record.solutionVideoLink ? <small>Video solution added</small> : null}
                      {record.itemType === 'question' && record.solutionImageUrl ? <small>Solution image added</small> : null}
                      {record.itemType === 'lesson' && record.geogebraLink ? <small>GeoGebra added</small> : null}
                      <small>Drag to reorder</small>
                      {record.imageUrl ? (
                        <div className="admin-record-image">
                          <img src={record.imageUrl} alt="Uploaded content" />
                        </div>
                      ) : null}
                      {record.resourceLink && (
                        <a href={record.resourceLink} target="_blank" rel="noreferrer">
                          Open link
                        </a>
                      )}
                      {record.attachedFileName && <small>File: {record.attachedFileName}</small>}
                      {editingRecordId === record.id ? (
                        <div className="stored-edit-grid">
                          {editingRecordType === 'lesson' ? (
                            <>
                              <label>
                                Title
                                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                              </label>
                              <label>
                                Description
                                <textarea
                                  rows={4}
                                  value={editDescription}
                                  onChange={(event) => setEditDescription(event.target.value)}
                                />
                              </label>
                              <label>
                                GeoGebra Link
                                <input
                                  value={editGeogebraLink}
                                  onChange={(event) => setEditGeogebraLink(event.target.value)}
                                  placeholder="https://www.geogebra.org/m/abc123"
                                />
                              </label>
                              <label>
                                Resource Link
                                <input
                                  value={editResourceLink}
                                  onChange={(event) => setEditResourceLink(event.target.value)}
                                  placeholder="https://..."
                                />
                              </label>
                            </>
                          ) : (
                            <>
                              <label>
                                Description
                                <textarea
                                  rows={4}
                                  value={editDescription}
                                  onChange={(event) => setEditDescription(event.target.value)}
                                />
                              </label>
                              <label>
                                Difficulty
                                <select value={editDifficulty} onChange={(event) => setEditDifficulty(event.target.value)}>
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                              </label>
                              <label>
                                Marks
                                <input
                                  type="number"
                                  min={1}
                                  value={editMarks}
                                  onChange={(event) => setEditMarks(event.target.value)}
                                />
                              </label>
                              <label>
                                Calculator Type
                                <select value={editGdc} onChange={(event) => setEditGdc(event.target.value)}>
                                  <option value="gdc">GDC</option>
                                  <option value="not gdc">Not GDC</option>
                                </select>
                              </label>
                              <label>
                                Solution (supports LaTeX)
                                <textarea
                                  rows={4}
                                  value={editSolution}
                                  onChange={(event) => setEditSolution(event.target.value)}
                                />
                              </label>
                              <label>
                                YouTube Video Solution Link
                                <input
                                  value={editSolutionVideoLink}
                                  onChange={(event) => setEditSolutionVideoLink(event.target.value)}
                                  placeholder="https://www.youtube.com/watch?v=..."
                                />
                              </label>
                              <label>
                                Resource Link
                                <input
                                  value={editResourceLink}
                                  onChange={(event) => setEditResourceLink(event.target.value)}
                                  placeholder="https://..."
                                />
                              </label>
                            </>
                          )}
                          <div className="stored-edit-actions">
                            <button type="button" className="btn primary" onClick={saveRecordEdits}>
                              Save
                            </button>
                            <button type="button" className="btn ghost" onClick={cancelEditRecord}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )
                })
              )}
            </div>
          </section>
          </>
          )}
        </div>
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [cachedProfile, setCachedProfile] = useState(() => {
    const cached = localStorage.getItem(profileCacheKey)
    return cached ? JSON.parse(cached) : null
  })

  useEffect(() => {
    let unsubscribe = () => {}
    let active = true

    async function setupAuthPersistence() {
      // Subscribe first so auth state resolves even if Firestore/setup calls are slow.
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        if (!active) return
        setUser(nextUser)
        setAuthReady(true)

        if (nextUser) {
          const profile = {
            uid: nextUser.uid,
            email: nextUser.email || '',
            displayName: nextUser.displayName || '',
            photoURL: nextUser.photoURL || '',
          }
          setCachedProfile(profile)
          localStorage.setItem(profileCacheKey, JSON.stringify(profile))
        } else {
          setCachedProfile(null)
          localStorage.removeItem(profileCacheKey)
        }
      })

      try {
        await setPersistence(auth, browserLocalPersistence)
      } catch {
        // Continue with Firebase default persistence if this fails.
      }

      try {
        const curriculaSnap = await getDoc(curriculaDocRef)
        if (!curriculaSnap.exists()) {
          await setDoc(curriculaDocRef, { courses: defaultCurricula })
        }
        const paywallSnap = await getDoc(paywallDocRef)
        if (!paywallSnap.exists()) {
          await setDoc(paywallDocRef, normalizePaywallConfig())
        }
        const eventsSnap = await getDoc(eventsDocRef)
        if (!eventsSnap.exists()) {
          await setDoc(eventsDocRef, { items: [] })
        }
        const teachersResourcesSnap = await getDoc(teachersResourcesDocRef)
        if (!teachersResourcesSnap.exists()) {
          await setDoc(teachersResourcesDocRef, { items: [] })
        }
      } catch {
        // Ignore seeding failure; admin view will still show actionable errors.
      }
    }

    setupAuthPersistence()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/programs" element={<ProgramsPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/events" element={<EventsPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/teachers-resources" element={<TeachersResourcesPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/terms-of-use" element={<TermsOfUsePage user={user} cachedProfile={cachedProfile} />} />
        <Route
          path="/courses/:slug"
          element={
            <CoursePage
              user={user}
              authReady={authReady}
              cachedProfile={cachedProfile}
            />
          }
        />
        <Route path="/profile" element={<ProfilePage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/admin" element={<ProtectedAdmin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
