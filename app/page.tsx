'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as XLSX from 'xlsx'
import { Download, RefreshCw, FileDown } from 'lucide-react'
import { IPResult, GroupedResults } from '@/lib/types'
import { processIPv4 } from '@/lib/utils'
import { generateExampleFile, parseFileData } from '@/lib/file-utils'
import { useRouter } from 'next/navigation'
import { Network } from 'lucide-react'
import { VLANStandardization } from '@/components/vlan-standardization';
import { VLANDocumentation } from '@/components/vlan-documentation';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import SubnetSplitter from '@/components/subnet-splitter';


export default function Home() {
  const [results, setResults] = useState<IPResult[]>([])
  const [singleIP, setSingleIP] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSingleIPSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const result = await processIPv4(singleIP)
      result.site = 'IP Unique'
      setResults([result])
      setSingleIP('')
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      }
    }
  }

  const handleTabChange = () => {
    setResults([])
    setError('')
    setSingleIP('')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    try {
      let rawData: Record<string, string>[] = [];

      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n');
        rawData = lines.slice(1).map((line) => {
          const [site, ip] = line.split(',').map((val) => val.trim());
          return { Site: site, IP: ip };
        });
      } else if (file.name.endsWith('.xml')) {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'application/xml');

        rawData = [];
        const entries = xmlDoc.getElementsByTagName('Entry');
        for (let i = 0; i < entries.length; i++) {
          const siteNode = entries[i].getElementsByTagName('Site')[0];
          const ipNode = entries[i].getElementsByTagName('IP')[0];
          const site = siteNode ? siteNode.textContent || '' : '';
          const ip = ipNode ? ipNode.textContent || '' : '';
          rawData.push({ Site: site, IP: ip });
        }
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        rawData = XLSX.utils.sheet_to_json(worksheet);
      }

      const processedData = parseFileData(rawData);
      const processedResults = await Promise.all(
        processedData.map(async (row) => {
          try {
            if (!row.IP) return null;
            const ipResult = await processIPv4(row.IP);
            return { ...ipResult, site: row.Site || 'Sans Site' };
          } catch {
            return null;
          }
        })
      );

      const validResults = processedResults.filter((r): r is IPResult => r !== null);
      setResults(validResults);

      if (validResults.length === 0) {
        setError('Aucune adresse IP valide trouvée dans le fichier');
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Erreur lors du traitement du fichier');
      }
    }

    e.target.value = '';
  };


  const groupResultsBySite = (results: IPResult[]): GroupedResults[] => {
    const groups = results.reduce((acc: { [key: string]: IPResult[] }, curr) => {
      const site = curr.site || 'Sans Site'
      if (!acc[site]) {
        acc[site] = []
      }
      acc[site].push(curr)
      return acc
    }, {})

    return Object.entries(groups).map(([site, ips]) => ({
      site,
      ips
    }))
  }

  const exportResults = (format: 'xlsx' | 'csv' | 'xml') => {
    if (!results.length) return;

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(results);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Résultats');
      XLSX.writeFile(wb, 'resultats-ip.xlsx');
    } else if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(results);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = 'resultats-ip.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Results>\n';
      results.forEach((result) => {
        xml += '  <Result>\n';
        for (const [key, value] of Object.entries(result)) {
          xml += `    <${key}>${value}</${key}>\n`;
        }
        xml += '  </Result>\n';
      });
      xml += '</Results>';

      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = 'resultats-ip.xml';
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  const resetResults = () => {
    setResults([])
    setError('')
  }

  const groupedResults = groupResultsBySite(results)

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Calculateur IP, <span className='text-gray-500 text-sm'>By Omar Almoctar COULIBALY, for </span> <span className='text-sm font-bold'>KEM ONE</span></h1>
            <p className="text-gray-500 mt-2">Analysez vos adresses IP et sous-réseaux</p>
          </div>
          <Button
            onClick={() => router.push('/planner')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <Network className="w-5 h-5 mr-2" />
            Planification Réseau
          </Button>
        </div>

        <Card className="p-6">
          <Tabs defaultValue="single" className="space-y-4" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="single">IP Unique</TabsTrigger>
              <TabsTrigger value="bulk">Import Fichier</TabsTrigger>
              <TabsTrigger value="vlans">Standardisation VLAN <span className='text-gray-600 font-bold'> {" "} / KEM ONE</span></TabsTrigger>
              <TabsTrigger value="split">Découpage Auto</TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <form onSubmit={handleSingleIPSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="ex: 192.168.1.0/24"
                    value={singleIP}
                    onChange={(e) => setSingleIP(e.target.value)}
                  />
                  <Button type="submit">Analyser</Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="bulk">
              <div className="space-y-4">
                <div className="flex flex-col gap-4">
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv,.xml"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 flex-1">
                      Formats acceptés : Excel (.xlsx, .xls), CSV (.csv), XML (.xml)
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500 flex-1">
                        Formats acceptés : Excel (.xlsx, .xls), CSV (.csv), XML (.xml)
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <FileDown className="w-4 h-4 mr-2" />
                            Télécharger exemple
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => generateExampleFile('xlsx')}>
                            Exemple Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateExampleFile('csv')}>
                            Exemple CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateExampleFile('xml')}>
                            Exemple XML
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent className='flex flex-col gap-4' value="vlans">
              <VLANDocumentation />
              <VLANStandardization />
            </TabsContent>

            <TabsContent value="split">
              <SubnetSplitter />
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-8 space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Résultats</h3>
                <div className="flex gap-2">
                  <Button onClick={resetResults} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Réinitialiser
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Exporter
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => exportResults('xlsx')}>
                        Exporter en Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportResults('csv')}>
                        Exporter en CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportResults('xml')}>
                        Exporter en XML
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {groupedResults.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-2">
                  <h4 className="font-bold text-blue-500">{group.site}</h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réseau</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Masque</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gateway</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Première IP</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière IP</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Broadcast</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {group.ips.map((result, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.ip}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.network}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.subnetMask}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.gateway}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.firstUsable}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.lastUsable}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.broadcast}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}