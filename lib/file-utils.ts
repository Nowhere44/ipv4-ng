import * as XLSX from 'xlsx'
import { IPData } from './types'

export function generateExampleFile(format: 'xlsx' | 'csv'): void {
    const data = [
        ['Site', 'IP'],
        ['Paris', ''],
        ['', '192.168.1.0/24'],
        ['', '192.168.2.0/24'],
        ['', '192.168.3.0/24'],
        ['Lyon', ''],
        ['', '10.0.0.0/24'],
        ['', '10.0.1.0/24']
    ]

    if (format === 'csv') {
        const csvContent = data
            .map(row => row.join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'exemple-format.csv'
        a.click()
        window.URL.revokeObjectURL(url)
    } else {
        const ws = XLSX.utils.aoa_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Example')
        XLSX.writeFile(wb, 'exemple-format.xlsx')
    }
}

export function parseFileData(rawData: Record<string, string>[]): IPData[] {
    let currentSite = ''
    const processedData: IPData[] = []

    for (const row of rawData) {
        const site = row.Site || row.SITE || row.site
        if (site) {
            currentSite = site
            continue
        }

        const ip = row.IP || row.ip || row.IPv4 || row.Adresse
        if (ip) {
            processedData.push({
                IP: ip,
                Site: currentSite || 'Sans Site'
            })
        }
    }

    return processedData
}