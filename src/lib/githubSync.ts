import type { AppData, DiarySyncData, GitHubSyncSettings } from '../types/electron'

const SETTINGS_STORAGE_KEY = 'daily:github-sync'
const GITHUB_WRITE_MAX_ATTEMPTS = 4
const GITHUB_WRITE_RETRY_DELAY_MS = 200
const DEFAULT_SYNC_SETTINGS: GitHubSyncSettings = {
  enabled: false,
  autoSyncEnabled: false,
  owner: '',
  repo: '',
  branch: 'main',
  basePath: 'daily-data',
  token: '',
}

type GitHubFile = {
  content: string
  sha: string
}

type GitHubErrorBody = {
  message?: string
  documentation_url?: string
}

export type GitHubSyncPayload = {
  tasks: AppData
  diaries: DiarySyncData
}

export function normalizeGitHubSyncSettings(raw: unknown): GitHubSyncSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SYNC_SETTINGS
  }

  const settings = raw as Partial<GitHubSyncSettings>

  return {
    enabled: Boolean(settings.enabled),
    autoSyncEnabled: Boolean(settings.autoSyncEnabled),
    owner: typeof settings.owner === 'string' ? settings.owner.trim() : '',
    repo: typeof settings.repo === 'string' ? settings.repo.trim() : '',
    branch: typeof settings.branch === 'string' && settings.branch.trim() ? settings.branch.trim() : 'main',
    basePath:
      typeof settings.basePath === 'string' && settings.basePath.trim()
        ? settings.basePath.trim().replace(/^\/+|\/+$/g, '')
        : 'daily-data',
    token: typeof settings.token === 'string' ? settings.token.trim() : '',
  }
}

export function loadGitHubSyncSettings() {
  if (typeof window === 'undefined') {
    return DEFAULT_SYNC_SETTINGS
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!raw) {
    return DEFAULT_SYNC_SETTINGS
  }

  try {
    return normalizeGitHubSyncSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_SYNC_SETTINGS
  }
}

export function saveGitHubSyncSettings(settings: GitHubSyncSettings) {
  const normalized = normalizeGitHubSyncSettings(settings)
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function hasGitHubSyncCredentials(settings: GitHubSyncSettings) {
  return Boolean(
    settings.enabled &&
      settings.owner &&
      settings.repo &&
      settings.branch &&
      settings.basePath &&
      settings.token,
  )
}

function getApiUrl(settings: GitHubSyncSettings, filename: string) {
  const path = [settings.basePath, filename]
    .filter(Boolean)
    .join('/')
    .split('/')
    .map(encodeURIComponent)
    .join('/')

  return `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(
    settings.repo,
  )}/contents/${path}`
}

function getHeaders(settings: GitHubSyncSettings) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${settings.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function encodeBase64(value: unknown) {
  const json = JSON.stringify(value, null, 2)
  const bytes = new TextEncoder().encode(json)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function decodeBase64<T>(content: string): T {
  const binary = atob(content.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const json = new TextDecoder().decode(bytes)

  return JSON.parse(json) as T
}

async function getGitHubErrorMessage(response: Response, action: string) {
  let detail = ''

  try {
    const body = (await response.json()) as GitHubErrorBody
    detail = body.message ? `：${body.message}` : ''
  } catch {
    // GitHub normally returns JSON error bodies. Fall back to status only.
  }

  return `${action}失败（${response.status} ${response.statusText}）${detail}`
}

async function readGitHubFile(settings: GitHubSyncSettings, filename: string) {
  const response = await fetch(`${getApiUrl(settings, filename)}?ref=${encodeURIComponent(settings.branch)}`, {
    headers: getHeaders(settings),
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(await getGitHubErrorMessage(response, `GitHub 读取 ${filename}`))
  }

  const data = (await response.json()) as GitHubFile
  return {
    sha: data.sha,
    data: decodeBase64<unknown>(data.content),
  }
}

async function writeGitHubFile(
  settings: GitHubSyncSettings,
  filename: string,
  value: unknown,
  sha?: string,
) {
  const content = encodeBase64(value)
  let currentSha = sha

  for (let attempt = 0; attempt < GITHUB_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(getApiUrl(settings, filename), {
      method: 'PUT',
      headers: {
        ...getHeaders(settings),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Sync Daily ${filename}`,
        branch: settings.branch,
        content,
        ...(currentSha ? { sha: currentSha } : {}),
      }),
    })

    if (response.ok) {
      return
    }

    if (response.status !== 409 || attempt === GITHUB_WRITE_MAX_ATTEMPTS - 1) {
      throw new Error(await getGitHubErrorMessage(response, `GitHub 写入 ${filename}`))
    }

    const latestFile = await readGitHubFile(settings, filename)
    currentSha = latestFile?.sha
    await new Promise((resolve) => {
      window.setTimeout(resolve, GITHUB_WRITE_RETRY_DELAY_MS * 2 ** attempt)
    })
  }
}

export async function pullGitHubData(settings: GitHubSyncSettings) {
  if (!hasGitHubSyncCredentials(settings)) {
    throw new Error('GitHub 同步设置不完整')
  }

  const [tasksFile, diariesFile] = await Promise.all([
    readGitHubFile(settings, 'tasks.json'),
    readGitHubFile(settings, 'diaries.json'),
  ])

  return {
    tasks: tasksFile?.data,
    diaries: diariesFile?.data,
  }
}

export async function pushGitHubData(settings: GitHubSyncSettings, payload: GitHubSyncPayload) {
  if (!hasGitHubSyncCredentials(settings)) {
    throw new Error('GitHub 同步设置不完整')
  }

  const tasksFile = await readGitHubFile(settings, 'tasks.json')
  await writeGitHubFile(settings, 'tasks.json', payload.tasks, tasksFile?.sha)

  const diariesFile = await readGitHubFile(settings, 'diaries.json')
  await writeGitHubFile(settings, 'diaries.json', payload.diaries, diariesFile?.sha)
}
