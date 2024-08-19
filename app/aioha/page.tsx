'use client'

import { useState } from 'react'
import { useAioha, AiohaModal } from '@aioha/react-ui'
import { KeyTypes } from '@aioha/aioha'
import { Button, useColorMode } from '@chakra-ui/react'
import '@aioha/react-ui/dist/build.css'

export default function AiohaPage() {
  const { colorMode } = useColorMode()
  const [modalDisplayed, setModalDisplayed] = useState(false)
  const { user } = useAioha()
  return (
    <>
      <Button onClick={() => setModalDisplayed(true)}>
        {user ?? 'Connect Wallet'}
      </Button>
      <div className={colorMode}>
        <AiohaModal
          displayed={modalDisplayed}
          loginOptions={{
            msg: 'Login',
            keyType: KeyTypes.Posting
          }}
          onLogin={console.log}
          onClose={setModalDisplayed}
        />
      </div>
    </>
  )
}