'use client'

import React, { useState } from 'react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { VLANManager } from '@/lib/vlan-manager';
import { DeviceForVLAN, VLANMigrationResult, SubnetReorganization, DeviceType } from '@/lib/vlan-types';
import { STANDARD_VLANS } from '@/lib/vlan-constants';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

export const VLANStandardization = () => {
    const [migrationResults, setMigrationResults] = useState<VLANMigrationResult[]>([]);
    const [conflicts, setConflicts] = useState<string[]>([]);
    const [subnetReorganization, setSubnetReorganization] = useState<SubnetReorganization[]>([]);
    const vlanManager = new VLANManager();

    const formatCapacity = (num: number): string => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    function mapRecordToDeviceForVLAN(obj: Record<string, string>): DeviceForVLAN {
        const deviceType = (obj['type'] || '').toLowerCase() as DeviceType;

        // Validation du type d'appareil
        const validDeviceTypes: DeviceType[] = [
            'pc',
            'printer',
            'workstation',
            'wifi',
            'wireless',
            'phone',
            'voip',
            'camera',
            'surveillance',
            'server',
            'iot',
            'sensor',
            'switch',
            'admin',
        ];

        if (!validDeviceTypes.includes(deviceType)) {
            console.warn(`Type d'appareil invalide: ${obj['type']}, appareil ignoré.`);
            throw new Error(`Type d'appareil invalide: ${obj['type']}`);
        }

        const device: DeviceForVLAN = {
            id: obj['id'] || '',
            name: obj['name'] || '',
            type: deviceType,
            currentVlan: obj['currentVlan'] ? Number(obj['currentVlan']) : undefined,
            zone: obj['zone'] || undefined,
            network: obj['network'] || undefined,
        };

        // Validation supplémentaire des champs requis
        if (!device.id || !device.name || !device.type) {
            throw new Error(`Données manquantes pour l'appareil: ${JSON.stringify(device)}`);
        }

        return device;
    }



    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            let jsonData: DeviceForVLAN[] = [];

            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                const lines = text.split('\n').filter(line => line.trim() !== '');
                const headers = lines[0].split(',').map(header => header.trim());
                jsonData = lines.slice(1).map((line) => {
                    const values = line.split(',').map(value => value.trim());
                    const obj: Record<string, string> = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index] || '';
                    });
                    // Utiliser la fonction de mappage
                    const device: DeviceForVLAN = mapRecordToDeviceForVLAN(obj);
                    return device;
                });
            } else if (file.name.endsWith('.xml')) {
                const text = await file.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'application/xml');
                const devices = Array.from(xmlDoc.getElementsByTagName('Device'));
                jsonData = devices.map((deviceNode) => {
                    const obj: Record<string, string> = {};
                    Array.from(deviceNode.childNodes).forEach((child) => {
                        if (child.nodeType === 1) {
                            obj[child.nodeName] = (child.textContent || '').trim();
                        }
                    });
                    // Utiliser la fonction de mappage
                    const device: DeviceForVLAN = mapRecordToDeviceForVLAN(obj);
                    return device;
                });
            } else {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawJsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);
                jsonData = rawJsonData.map(obj => mapRecordToDeviceForVLAN(obj));
            }

            vlanManager.setDevices(jsonData);
            const results = vlanManager.generateMigrationPlan();
            const foundConflicts = vlanManager.checkConflicts();

            const reorganization = vlanManager.reorganizeSubnets();
            setSubnetReorganization(reorganization);

            setMigrationResults(results);
            setConflicts(foundConflicts);
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
        }

        // Réinitialiser la valeur du champ fichier
        e.target.value = '';
    };



    const exportMigrationPlan = (format: 'xlsx' | 'csv' | 'xml') => {
        const exportData = vlanManager.exportMigrationPlan();

        if (format === 'xlsx') {
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Plan Migration VLAN');
            XLSX.writeFile(wb, 'plan-migration-vlan.xlsx');
        } else if (format === 'csv') {
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = 'plan-migration-vlan.csv';
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'xml') {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<MigrationPlan>\n';
            exportData.slice(1).forEach((row) => {
                xml += '  <Device>\n';
                exportData[0].forEach((key, index) => {
                    xml += `    <${key}>${row[index]}</${key}>\n`;
                });
                xml += '  </Device>\n';
            });
            xml += '</MigrationPlan>';

            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = 'plan-migration-vlan.xml';
            a.click();
            URL.revokeObjectURL(url);
        }
    };


    const generateExampleFile = (format: 'xlsx' | 'csv' | 'xml') => {
        const exampleData = [
            ['name', 'type', 'zone', 'currentVlan', 'network', 'id'],

            // Réseau 192.168.1.0/24 - Paris
            ['PC-PARIS-001', 'pc', 'Paris', '15', '192.168.1.0/24', '1'],
            ['PC-PARIS-002', 'pc', 'Paris', '15', '192.168.1.0/24', '2'],
            ['PRINTER-PARIS-001', 'printer', 'Paris', '20', '192.168.1.0/24', '3'],

            // Réseau 192.168.2.0/24 - Lyon
            ['PC-LYON-001', 'pc', 'Lyon', '15', '192.168.2.0/24', '4'],
            ['PRINTER-LYON-001', 'printer', 'Lyon', '20', '192.168.2.0/24', '5'],
            ['PHONE-LYON-001', 'phone', 'Lyon', '30', '192.168.2.0/24', '6'],

            // Réseau 172.16.0.0/16 - Marseille
            ['SERVER-MARSEILLE-001', 'server', 'Marseille', '451', '172.16.0.0/16', '7'],
            ['PC-MARSEILLE-001', 'pc', 'Marseille', '15', '172.16.1.0/24', '8'],
            ['PRINTER-MARSEILLE-001', 'printer', 'Marseille', '20', '172.16.1.0/24', '9'],
            ['IOT-MARSEILLE-001', 'iot', 'Marseille', '461', '172.16.2.0/24', '10'],

            // Réseau 10.0.0.0/8 - Nice
            ['SWITCH-NICE-001', 'switch', 'Nice', '800', '10.0.0.0/8', '11'],
            ['CAMERA-NICE-001', 'camera', 'Nice', '100', '10.1.0.0/16', '12'],
            ['IOT-NICE-001', 'iot', 'Nice', '461', '10.1.1.0/24', '13'],
            ['PHONE-NICE-001', 'phone', 'Nice', '30', '10.1.2.0/24', '14'],

            // Réseau avec masque /26
            ['WIFI-PARIS-001', 'wifi', 'Paris', '92', '192.168.3.0/26', '15'],
            ['WIFI-PARIS-002', 'wifi', 'Paris', '92', '192.168.3.64/26', '16'],

            // Appareils avec réseaux qui se chevauchent
            ['PC-OVERLAP-001', 'pc', 'Paris', '15', '192.168.4.0/25', '17'],
            ['PRINTER-OVERLAP-001', 'printer', 'Paris', '20', '192.168.4.128/25', '18'],

            // Réseau avec un grand nombre d'appareils (simulateur)
            ...Array.from({ length: 50 }, (_, i) => [
                `PC-BIGNETWORK-${i + 1}`, 'pc', 'Paris', '15', '192.168.5.0/24', `${19 + i}`
            ]),

            // Appareils sans zone spécifiée
            ['UNKNOWN-ZONE-001', 'iot', '', '461', '192.168.6.0/24', '69'],
            ['UNKNOWN-ZONE-002', 'pc', '', '15', '192.168.6.0/24', '70'],

            // Appareils avec masques variés
            ['PRINTER-LYON-002', 'printer', 'Lyon', '20', '172.16.3.0/25', '71'],
            ['IOT-LYON-001', 'iot', 'Lyon', '461', '172.16.3.128/25', '72'],

            // Appareils dans des sous-réseaux inexistants (pour tester la réorganisation)
            ['NEW-DEVICE-001', 'pc', 'Paris', '15', '192.168.255.0/24', '73'],
            ['NEW-DEVICE-002', 'printer', 'Paris', '20', '192.168.254.0/24', '74'],
        ];


        if (format === 'xlsx') {
            const ws = XLSX.utils.aoa_to_sheet(exampleData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Example');
            XLSX.writeFile(wb, 'exemple-migration-vlan.xlsx');
        } else if (format === 'csv') {
            const ws = XLSX.utils.aoa_to_sheet(exampleData);
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = 'exemple-migration-vlan.csv';
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'xml') {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ExampleDevices>\n';
            exampleData.slice(1).forEach((row) => {
                xml += '  <Device>\n';
                exampleData[0].forEach((key, index) => {
                    xml += `    <${key}>${row[index]}</${key}>\n`;
                });
                xml += '  </Device>\n';
            });
            xml += '</ExampleDevices>';

            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'exemple-migration-vlan.xml';
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Standardisation des VLANs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-4">
                    {/* Section Upload */}
                    <div className="flex flex-col gap-4">
                        <Input
                            type="file"
                            accept=".xlsx,.xls,.csv,.xml"
                            onChange={handleFileUpload}
                            className="cursor-pointer w-3/4"
                        />
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-500 flex-1">
                                Formats acceptés : Excel (.xlsx, .xls), CSV (.csv), XML (.xml)
                            </p>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        <Download className="w-4 h-4 mr-2" />
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

                    {/* Section Conflits */}
                    {conflicts.length > 0 && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                <ul className="list-disc pl-4">
                                    {conflicts.map((conflict, index) => (
                                        <li key={index}>{conflict}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Section Résultats */}
                    {migrationResults.length > 0 && (
                        <>
                            {/* Bouton Export */}
                            <div className="flex justify-end">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button>
                                            <Download className="w-4 h-4 mr-2" />
                                            Exporter le plan
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => exportMigrationPlan('xlsx')}>
                                            Exporter en Excel
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportMigrationPlan('csv')}>
                                            Exporter en CSV
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportMigrationPlan('xml')}>
                                            Exporter en XML
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="space-y-8">
                                {/* Tableau des migrations VLAN */}
                                <div>
                                    <h3 className="text-lg font-medium mb-4">Plan de migration VLAN</h3>
                                    <div className="border rounded-lg overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Appareil</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Réseau Actuel</TableHead>
                                                    <TableHead>VLAN Actuel</TableHead>
                                                    <TableHead>VLAN Suggéré</TableHead>
                                                    <TableHead>Nom du VLAN</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {migrationResults.map((result, index) => (
                                                    <TableRow key={index} className={result.hasConflict ? 'bg-red-50' : ''}>
                                                        <TableCell>{result.device.name}</TableCell>
                                                        <TableCell>{result.device.type}</TableCell>
                                                        <TableCell>{result.device.network}</TableCell>
                                                        <TableCell>{result.device.currentVlan || 'N/A'}</TableCell>
                                                        <TableCell>{result.suggestedVlan.id}</TableCell>
                                                        <TableCell>{result.suggestedVlan.name}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Tableau de réorganisation des sous-réseaux */}
                                {subnetReorganization.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-medium mb-4">Remaniement des sous-réseaux</h3>
                                        <div className="border rounded-lg overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Sous-réseau actuel</TableHead>
                                                        <TableHead>Nouveau sous-réseau</TableHead>
                                                        <TableHead>Capacité</TableHead>
                                                        <TableHead>Raison du changement</TableHead>
                                                        <TableHead>VLAN</TableHead>
                                                        <TableHead>Appareils</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {subnetReorganization.map((reorg, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{reorg.originalSubnet}</TableCell>
                                                            <TableCell>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger className="flex items-center gap-1">
                                                                            {reorg.newSubnet}
                                                                            <HelpCircle className="h-4 w-4" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Capacité totale: {formatCapacity(reorg.capacityInfo?.total || 0)} hôtes</p>
                                                                            <p>Utilisés: {formatCapacity(reorg.capacityInfo?.used || 0)} hôtes</p>
                                                                            <p>Disponibles: {formatCapacity(reorg.capacityInfo?.available || 0)} hôtes</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </TableCell>
                                                            <TableCell>
                                                                {formatCapacity(reorg.deviceCount)} / {formatCapacity(reorg.capacityInfo?.total || 0)}
                                                            </TableCell>
                                                            <TableCell>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger className="flex items-center gap-1 text-left">
                                                                            <AlertCircle className="h-4 w-4" />
                                                                            {reorg.reason}
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{reorg.reason}</p>
                                                                            {reorg.capacityInfo && (
                                                                                <p>Utilisation: {((reorg.capacityInfo.used / reorg.capacityInfo.total) * 100).toFixed(1)}%</p>
                                                                            )}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </TableCell>
                                                            <TableCell>
                                                                {STANDARD_VLANS.find(v => v.id === reorg.vlan)?.name || 'N/A'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-sm text-gray-600">
                                                                    {reorg.devices.map(d => d.name).join(', ')}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}