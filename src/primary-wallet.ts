// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

import type { dappAPI } from '@canton-network/dapp-sdk'

import { networkConfig } from './networks'

export function primaryParty(
    accounts: readonly dappAPI.Wallet[],
    networkId: string | undefined
): string {
    if (!networkConfig(networkId))
        throw new Error('Connect a wallet on Canton DevNet or TestNet.')
    const primary = accounts.filter((account) => account.primary)
    if (primary.length !== 1) {
        throw new Error('Select one primary wallet in your wallet provider.')
    }
    if (primary[0].disabled || primary[0].networkId !== networkId) {
        throw new Error('The primary wallet is not available on the connected network.')
    }
    return primary[0].partyId
}
