import type { MemberId } from '../common/primitives'

/** A person on the project team. */
export interface Member {
  readonly id: MemberId
  readonly name: string
  readonly role: string
  readonly initials: string
  readonly color: string
  /** Hourly rate in cents, in the project currency. */
  readonly rateCents: number | null
  /** Daily capacity (hours of actual work). */
  readonly hoursPerDay: number
}

export type MemberFields = Omit<Member, 'id'>
export type MemberPatch = Partial<MemberFields>

/** Details to add a person; whatever is missing is filled in with default values. */
export type MemberInput = Partial<MemberFields> & { readonly name: string }

/** "Ann Smith" → "AS"; "Ann" → "AN". */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}
