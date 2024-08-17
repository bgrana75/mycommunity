import HiveClient from "@/lib/hive/hiveclient"
import { useEffect, useState } from "react"
import { Account } from "@hiveio/dhive";

interface HiveAccountMetadataProps {
  [key: string]: any
}
interface HiveAccount extends Account {
  witness_votes: string[];
  reputation?: number | string
  metadata?: HiveAccountMetadataProps
}

export default function useHiveAccount(username: string) {
    const [hiveAccount, setHiveAccount] = useState<HiveAccount | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const handleGetHiveAccount = async () => {
            setIsLoading(true)
            setError(null)
            try {
                const userData = await HiveClient.database.getAccounts([username])
                const userAccount: HiveAccount = {
                    ...userData[0],
                }
                if (userAccount.posting_json_metadata) {
                    userAccount.metadata = JSON.parse(userAccount.posting_json_metadata)
                } else if (userAccount.json_metadata) {
                    userAccount.metadata = JSON.parse(userAccount.json_metadata)
                } else {
                    userAccount.metadata = {} 
                }
                setHiveAccount(userAccount)
            } catch {
                setError("Loading account error!")
            } finally {
                setIsLoading(false)
            }
        }
        handleGetHiveAccount()
    }, [username]);
    return { hiveAccount, isLoading, error }
}
