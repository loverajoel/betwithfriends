# Bet with friends

An example DApp for Canton Network. Make a bet, share a link, and let the creator
pick the winning side. Includes a wallet-free demo, browser-generated sound
effects, and downloadable meme cards.

## Run locally

Use Node.js 24 LTS.

```sh
npm ci
npm run dev
```

Open [localhost:8084](http://localhost:8084) for the wallet flow or
[Demo Mode](http://localhost:8084/?demo=1) to try it without a wallet. Run
`npm run build` to create a production bundle in `dist/`.

### Demo Mode

Create a bet and open its invite in several tabs in the same browser. Use the
account menu to switch demo players. Everyone can pick either side. The creator
settles the bet after both sides have stakes. Winners get their stakes back and
split the losing side’s pot. Demo balances and bets are stored in the browser.

### Canton wallets

Connect a compatible primary wallet on Canton DevNet or TestNet. A local Wallet
Gateway defaults to port 3030 and must allow the exact app origin in
`server.allowedOrigins`. Allow popups for the app origin if the picker is blocked.
To share a live invite across devices, run the app at an origin everyone can
reach.

Live bets use real CC on the selected network and support two wallets on
opposite sides. The creator is the settlement executor and can direct the
locked funds. Participants need to trust the creator and verify the creator’s
stake before joining if their wallet cannot see it. Registry expiry can be
earlier than the bet deadline. Wallet history only includes ledger events the
connected party can see.

Invite links include readable bet terms. Allocation metadata is visible to its
stakeholders and the token administrator. Opening a CCView transaction link
shares its update ID with the explorer.

## Code

- `src/App.tsx` wires app state, wallet connections, and bet actions together.
- `src/ui/` contains the header, composer, bet lists, detail view, and artwork effects.
- `src/bet-ledger.ts`, `src/ledger-client.ts`, and `src/bet-history.ts` handle
  terms, Canton allocations, settlement, and history.
- `src/demo-ledger.ts` implements the browser-local demo ledger.

The Canton example code includes Apache 2.0 notices. See [LICENSE](LICENSE).
