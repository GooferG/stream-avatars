import { describe, expect, it } from 'vitest'
import { InteractionGate, refusalText, type GateFacts, type TargetFacts } from './gate'

const bob: TargetFacts = { login: 'bob', lurking: false, optedOut: false, busy: false }
const facts = (over: Partial<GateFacts> = {}): GateFacts => ({
  sender: 'alice',
  senderOptedOut: false,
  senderBusy: false,
  name: 'bob',
  target: bob,
  ...over,
})

describe('InteractionGate', () => {
  it('lets a pair command through when every rule holds', () => {
    expect(new InteractionGate(15_000, 30_000).check(facts(), 0)).toBeNull()
  })

  it('checks the rules in order', () => {
    const gate = new InteractionGate(15_000, 30_000)
    const bad: TargetFacts = { login: 'bob', lurking: true, optedOut: true, busy: true }
    expect(gate.check(facts({ senderOptedOut: true, senderBusy: true, name: null }), 0)).toBe('senderOptedOut')
    expect(gate.check(facts({ senderBusy: true, name: null }), 0)).toBe('senderBusy')
    expect(gate.check(facts({ name: null, target: null }), 0)).toBe('noName')
    expect(gate.check(facts({ target: null }), 0)).toBe('missing')
    expect(gate.check(facts({ target: { ...bad, login: 'alice' } }), 0)).toBe('self')
    expect(gate.check(facts({ target: bad }), 0)).toBe('lurking')
    expect(gate.check(facts({ target: { ...bad, lurking: false } }), 0)).toBe('optedOut')
    expect(gate.check(facts({ target: { ...bad, lurking: false, optedOut: false } }), 0)).toBe('busy')
  })

  it('starts the sender cooldown only when told to, and it outranks a missing target', () => {
    const gate = new InteractionGate(15_000, 30_000)
    expect(gate.check(facts(), 0)).toBeNull()
    expect(gate.check(facts(), 1)).toBeNull() // checking never starts it
    gate.senderActed('alice', 1_000)
    expect(gate.check(facts({ target: null }), 15_999)).toBe('cooldown')
    expect(gate.check(facts({ sender: 'carol' }), 15_999)).toBeNull() // per sender
    expect(gate.check(facts(), 16_000)).toBeNull()
  })

  it('keeps everyone in an interaction untargetable for the target cooldown', () => {
    const gate = new InteractionGate(15_000, 30_000)
    gate.targeted(['alice', 'bob'], 0)
    expect(gate.check(facts({ sender: 'carol' }), 29_999)).toBe('targetCooldown')
    const alice: TargetFacts = { ...bob, login: 'alice' }
    expect(gate.check(facts({ sender: 'carol', name: 'alice', target: alice }), 29_999)).toBe('targetCooldown')
    expect(gate.check(facts({ sender: 'carol' }), 30_000)).toBeNull()
  })

  it('turns a cooldown off at 0', () => {
    const gate = new InteractionGate(0, 0)
    gate.senderActed('alice', 0)
    gate.targeted(['bob'], 0)
    expect(gate.check(facts(), 0)).toBeNull()
  })
})

describe('refusalText', () => {
  it('tells the sender why, naming the target', () => {
    expect(refusalText('senderOptedOut', 'hug', 'Bob')).toBe('you opted out (!interact)')
    expect(refusalText('noName', 'highfive', '')).toBe('who? try !highfive @name')
    expect(refusalText('missing', 'hug', 'bob')).toBe("bob isn't here")
    expect(refusalText('lurking', 'hug', 'Bob')).toBe('Bob is lurking')
    expect(refusalText('optedOut', 'hug', 'Bob')).toBe('Bob opted out')
    expect(refusalText('busy', 'hug', 'Bob')).toBe('Bob is busy')
  })

  it('stays silent for cooldowns, yourself and your own interaction', () => {
    for (const reason of ['cooldown', 'targetCooldown', 'self', 'senderBusy'] as const) {
      expect(refusalText(reason, 'hug', 'Bob')).toBeNull()
    }
  })
})
