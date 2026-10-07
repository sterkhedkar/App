# Bhishi Manager

A web app to run a **bhishi** (chit fund / ROSCA): set up a group, manage members, run draws or auctions, track payments, and see the math behind every round.

## Features

- **Onboarding wizard** in 5 steps: basics (name, organizer, start date, frequency), money (members, instalment, commission, plus working back from a target pot), method, members (one by one or pasted as a list, reordered for fixed-order), and a review with the projected schedule.
- **Member management**: add, edit (name, phone, email, notes), search, put on hold (left out of draws) and remove. A member who has already won can't be removed, because they still owe instalments.
- **Draws and payments**: random lottery draw using `crypto.getRandomValues`, a fixed-order payout, or recording an auction's highest bidder and bid. Per-member paid/unpaid tracking for each round, and undo for the last result.
- **Five calculation methods** (`src/lib/calc.ts`):
  | Method | How it works |
  |---|---|
  | Lottery | Equal instalments; a random winner takes the full pot |
  | Fixed order | Same money as lottery, with the order agreed up front |
  | Auction (boli) | Highest discount bid wins; the discount is paid back as a dividend that lowers instalments |
  | Fixed discount | A pre-agreed discount that falls from round 1 to the end; the winner is drawn by lottery |
  | Premium | Members who have already won pay an extra % on later instalments, so later pots are bigger |
  Options: organizer commission (% of the chit value), and whether the dividend goes to all members or only to those yet to win.
- **Calculator**: compares all methods side by side (first and last payout, best and worst net, organizer earnings), shows the outcome for each winning position, and gives an **effective yearly rate** (IRR) showing how much early winners pay and late winners earn.

Data is stored in the browser's `localStorage`. Each bhishi can be exported as JSON.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # math engine tests
npm run build
```
