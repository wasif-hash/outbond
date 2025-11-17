export interface ApolloLead {
  id: string
  first_name: string
  last_name: string
  title: string
  company_name: string
  domain: string
  email: string
  linkedin_url: string
  phone?: string
  industry?: string
  street_address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  formatted_address?: string
  summary?: string
  raw_person?: RawApolloLead | null
}

export interface ApolloBulkMatchPersonRequest {
  identifier: string
  first_name?: string
  last_name?: string
  title?: string
  organization_name?: string
  domain?: string
  linkedin_url?: string
  email?: string
  city?: string
  state?: string
  country?: string
}

export interface ApolloBulkMatchPersonResponse {
  request?: {
    identifier?: string
    client_identifier?: string
  }
  person?: {
    id?: string
    email?: string
    emails?: Array<{ value?: string; email?: string }>
    emails_raw?: string[]
    phone_number?: string
    mobile_number?: string
    phone_numbers?: Array<{ number?: string } | string>
    linkedin_url?: string
    city?: string
    state?: string
    country?: string
    street_address?: string
    postal_code?: string
    formatted_address?: string
    organization?: ApolloOrganization
  }
}

export interface ApolloBulkMatchResponse {
  people?: ApolloBulkMatchPersonResponse[]
  matches?: Array<{
    id?: string
    client_identifier?: string
    email?: string
    emails?: Array<{ email?: string; value?: string }>
    emails_raw?: string[]
    phone_number?: string
    mobile_number?: string
    phone_numbers?: Array<{ number?: string } | string>
    linkedin_url?: string
    street_address?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
    formatted_address?: string
    organization?: ApolloOrganization
  }>
}

export interface ApolloRevealEmailResponse {
  email?: string | null
}

export type ApolloHttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' | 'HEAD'

export interface ApolloOrganization {
  name?: string
  website_url?: string
  linkedin_url?: string
  industry?: string
}

export type ApolloPhoneEntry = { number?: string | null } | string | null

export interface RawApolloLead {
  id?: string
  first_name?: string | null
  last_name?: string | null
  title?: string | null
  organization?: ApolloOrganization | null
  email?: string | null
  linkedin_url?: string | null
  phone_numbers?: ApolloPhoneEntry[] | null
  street_address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  formatted_address?: string | null
}

export interface ApolloSearchResponse {
  people: Array<{
    id: string
    first_name: string
    last_name: string
    title: string
    organization: ApolloOrganization & { name: string; website_url: string }
    email: string
    linkedin_url: string
    phone_numbers?: Array<{ number?: string | null }>
    city?: string | null
    state?: string | null
    country?: string | null
    street_address?: string | null
    postal_code?: string | null
    formatted_address?: string | null
  }>
  pagination: {
    total_entries: number
    per_page: number
    current_page: number
    total_pages: number
  }
}

export interface ApolloSearchFilters {
  person_titles: string[]
  person_locations: string[]
  keywords?: string[]
  page?: number
  per_page?: number
}
