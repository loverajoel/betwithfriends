// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/pixelify-sans/index.css'

import App from './App'
import { retroTheme } from './app-url'

import './index.css'
import './retro.css'

if (retroTheme) {
    document.documentElement.dataset.theme = 'retro'
} else {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f6f1e8')
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App demo={new URLSearchParams(location.search).get('demo') === '1'} />
    </StrictMode>
)
