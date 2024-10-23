export interface IPData {
    Site?: string
    SITE?: string
    site?: string
    IP?: string
    ip?: string
    IPv4?: string
    Adresse?: string
}

export interface IPResult {
    ip: string
    network: string
    subnetMask: string
    firstUsable: string
    lastUsable: string
    broadcast: string
    gateway: string
    site: string
}

export interface GroupedResults {
    site: string
    ips: IPResult[]
}