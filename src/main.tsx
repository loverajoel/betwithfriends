// Copyright (c) 2025-2026 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Modified for Bet with friends.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/pixelify-sans/index.css'

import App from './App'

import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App demo={new URLSearchParams(location.search).get('demo') === '1'} />
    </StrictMode>
)
