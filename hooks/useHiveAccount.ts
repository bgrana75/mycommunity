import HiveClient from "@/lib/hive/hiveclient"
import { useEffect, useState } from "react"
import { ExtendedAccount } from "@hiveio/dhive";

interface HiveAccountMetadataProps {
  [key: string]: any
}
export interface HiveAccount extends ExtendedAccount {
  metadata?: HiveAccountMetadataProps
}

export default function useHiveAccount(username: string) {
    const [hiveAccount, setHiveAccount] = useState<HiveAccount | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        if (!username) {
            setHiveAccount(null)
            return
        }
        const handleGetHiveAccount = async () => {
            setError(null)
            // Hive account names are 3-16 chars; anything else 400s at the node.
            if (username.length < 3 || username.length > 16) {
                setHiveAccount(null)
                setError("User not found")
                return
            }
            setIsLoading(true)
            try {
                const userData = await HiveClient.database.getAccounts([username])
                if (!userData[0]) {
                    setHiveAccount(null)
                    setError("User not found")
                    return
                }
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
    }, [username, refreshKey]);

    const refetch = () => setRefreshKey(k => k + 1)

    return { hiveAccount, isLoading, error, refetch }
}
