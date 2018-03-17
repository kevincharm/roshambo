import { SlackClient, readMessage } from 'slacklib'
import { getConfig } from '../../config'
import { Mode } from '../util'

export enum Selection {
  Rock = 'r',
  Scissors = 's',
  Paper = 'p',
  Spok = 'k',
  Lizard = 'l'
}

export async function getSelection(
  bot: SlackClient,
  mode: Mode,
  userId: string,
  timeout: number,
  preText = ''
): Promise<Selection> {
  if (userId === 'ai') {
    const guess = Math.round(Math.random() * 2)
    switch (guess) {
      case 0:
        return Selection.Rock
      case 1:
        return Selection.Scissors
      case 2:
        return Selection.Paper
    }
  }

  const cfg = getConfig()
  const available = validSelections[mode].map(sel => `(*${sel}*) ${descriptions[sel]}`).join(', ')
  const result = await bot.directMessage(userId, {
    text: preText + `Enter your selection: ${available}`,
    ...cfg.defaultParams
  })

  if (!result) {
    throw new Error(`Failed to message user`)
  }

  if (!result.ok) {
    throw new Error(`Failed to message user: ${(result as any).error}`)
  }

  const response = await readMessage(bot, userId, { directOnly: true, timeout }).catch(() => {
    throw new TimeoutError()
  })

  const selection = toSelection(mode, (response || '').trim().slice(0, 1))
  if (!selection) {
    return getSelection(bot, mode, userId, timeout, 'Invalid selection. ')
  }

  const isValidForMode = validSelections[mode].some(sel => sel === selection)
  if (!isValidForMode) {
    return getSelection(bot, mode, userId, timeout, 'Invalid selection. ')
  }

  await bot.directMessage(userId, { text: 'Response accepted', ...cfg.defaultParams })
  return selection
}

const descriptions: { [sel in Selection]: string } = {
  [Selection.Rock]: 'rock',
  [Selection.Paper]: 'paper',
  [Selection.Scissors]: 'scissors',
  [Selection.Lizard]: 'lizard',
  [Selection.Spok]: 'spok'
}

const validSelections: { [mode in Mode]: Selection[] } = {
  classic: [Selection.Rock, Selection.Paper, Selection.Scissors],
  bo3: [Selection.Rock, Selection.Paper, Selection.Scissors],
  ls: [Selection.Rock, Selection.Paper, Selection.Scissors, Selection.Lizard, Selection.Spok]
}

function toSelection(mode: Mode, selection: string) {
  switch (selection) {
    case 'r':
      return Selection.Rock

    case 's':
      return Selection.Scissors

    case 'p':
      return Selection.Paper

    case 'k':
      return Selection.Spok

    case 'l':
      return Selection.Lizard
  }
  return
}

export class TimeoutError extends Error {}

export function toString(selection: Selection): string {
  switch (selection) {
    case Selection.Paper:
      return '(paper) :raised_back_of_hand:'

    case Selection.Rock:
      return '(rock) :fist:'

    case Selection.Scissors:
      return '(scissors) :v:'

    case Selection.Lizard:
      return '(lizard) :lizard:'

    case Selection.Spok:
      return '(spok) :spock-hand:'
  }
}

interface MsgOpts {
  name: string
  select: Selection
}

export function getWinner(left: Selection, right: Selection) {
  if (left === right) {
    return Result.Draw
  }

  switch (left) {
    case Selection.Rock:
      return right === Selection.Scissors || right === Selection.Lizard ? Result.Left : Result.Right

    case Selection.Paper:
      return right === Selection.Rock || right === Selection.Spok ? Result.Left : Result.Right

    case Selection.Scissors:
      return right === Selection.Paper || right === Selection.Lizard ? Result.Left : Result.Right

    case Selection.Lizard:
      return right === Selection.Spok || right === Selection.Paper ? Result.Left : Result.Right

    case Selection.Spok:
      return right === Selection.Scissors || right === Selection.Rock ? Result.Left : Result.Right
  }

  throw new Error('Unable to determine Roshambo winner: Invalid selections')
}

export function toMessage(left: MsgOpts, right: MsgOpts) {
  const score = getWinner(left.select, right.select)
  const winner = score === 1 ? left : score === 0 ? left : right
  const loser = score === -1 ? left : score === 0 ? right : right

  const lsel = winner.select
  const lname = winner.name
  const ltext = toString(lsel)

  const rsel = loser.select
  const rname = loser.name
  const rtext = toString(rsel)
  if (lsel === rsel) {
    return `${winner.name} and ${loser.name} both picked ${lsel}!`
  }

  const toText = (text: string) => `*${lname}* ${ltext} ${text} *${rname}* ${rtext}!`

  switch (lsel) {
    case Selection.Scissors:
      return rsel === Selection.Paper ? toText('shredded') : toText('decapitated')

    case Selection.Rock:
      return rsel === Selection.Scissors ? toText('crushed') : toText('crushed')

    case Selection.Paper:
      return rsel === Selection.Rock ? toText('smothered') : toText('disproved')

    case Selection.Lizard:
      return rsel === Selection.Paper ? toText('devoured') : toText('poisoned')

    case Selection.Spok:
      return rsel === Selection.Scissors ? toText('smashed') : toText('vaporized')
  }
}

export enum Result {
  Left = 1,
  Right = -1,
  Draw = 0
}
