// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

const devnet = {
    name: 'DevNet',
    registry: 'https://scan.sv-1.dev.global.canton.network.sync.global',
    explorer: 'https://devnet.ccview.io/',
}

const testnet = {
    name: 'TestNet',
    registry: 'https://scan.sv-1.test.global.canton.network.sync.global',
    explorer: 'https://testnet.ccview.io/',
}

export function networkConfig(networkId: string | undefined) {
    switch (networkId) {
        case 'canton:devnet':
        case 'canton:local-devnet':
            return devnet
        case 'canton:testnet':
            return testnet
        default:
            return undefined
    }
}

export type NetworkConfig = NonNullable<ReturnType<typeof networkConfig>>
