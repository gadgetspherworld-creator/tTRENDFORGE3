import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_GATEWAY_URL ?? 'http://localhost:3001'

async function handler(req: NextRequest, { params }: { params: { route?: string[] } }) {
  const path    = params.route?.join('/') ?? ''
  const url     = `${API_URL}/api/v1/${path}${req.nextUrl.search}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = req.headers.get('authorization') ?? req.cookies.get('tf_token')?.value
  if (auth) headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`

  const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await req.text() : undefined
  const res  = await fetch(url, { method: req.method, headers, body })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
