import { createContext, useContext } from 'react'

/** Where cards and tables link to: the admin app, or a tournament's public pages. */
export interface Links {
  isPublic: boolean
  match: (id: string) => string
  player: (id: string) => string
  team: (id: string) => string
}

export const adminLinks: Links = {
  isPublic: false,
  match: (id) => `/matches/${id}`,
  player: (id) => `/players/${id}`,
  team: (id) => `/teams/${id}`,
}

export const publicLinks = (code: string): Links => ({
  isPublic: true,
  match: (id) => `/t/${code}/m/${id}`,
  player: (id) => `/t/${code}/p/${id}`,
  team: (id) => `/t/${code}/team/${id}`,
})

export const LinksContext = createContext<Links>(adminLinks)
export const useLinks = () => useContext(LinksContext)
