import { createContext, useContext } from 'react'

export const ClientContext = createContext({
  clientSlug: null,
  clientId: null,
  clientConfig: null,
  userMember: null,
  userType: 'team',
  storeClient: null,
})

export function useClient() {
  return useContext(ClientContext)
}
