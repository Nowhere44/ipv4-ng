'use client'

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { VLANManager } from '@/lib/vlan-manager';
import { DeviceForVLAN, VLANMigrationResult, SubnetReorganization } from '@/lib/vlan-types';
import { STANDARD_VLANS } from '@/lib/vlan-constants';

export const VLANStandardization = () => {
    const [migrationResults, setMigrationResults] = useState<VLANMigrationResult[]>([]);
    const [conflicts, setConflicts] = useState<string[]>([]);
    const [subnetReorganization, setSubnetReorganization] = useState<SubnetReorganization[]>([]);
    const vlanManager = new VLANManager();


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as DeviceForVLAN[];

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
    };

    const exportMigrationPlan = () => {
        const exportData = vlanManager.exportMigrationPlan();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Plan Migration VLAN');
        XLSX.writeFile(wb, 'plan-migration-vlan.xlsx');
    };

    const generateExampleFile = () => {
        const exampleData = [
            ['name', 'type', 'zone', 'currentVlan', 'network', 'id'],
            // Groupe de PCs dans le même sous-réseau
            ['PC-PARIS-001', 'pc', 'Paris', '15', '192.168.1.0/24', '1'],
            ['PC-PARIS-002', 'pc', 'Paris', '15', '192.168.1.0/24', '2'],
            ['PC-PARIS-003', 'pc', 'Paris', '15', '192.168.1.0/24', '3'],

            // Groupe d'imprimantes
            ['PRINTER-PARIS-001', 'printer', 'Paris', '20', '192.168.2.0/24', '4'],
            ['PRINTER-PARIS-002', 'printer', 'Paris', '20', '192.168.2.0/24', '5'],

            // Téléphones VoIP
            ['PHONE-001', 'phone', 'Paris', '30', '192.168.3.0/24', '6'],
            ['PHONE-002', 'phone', 'Paris', '30', '192.168.3.0/24', '7'],
            ['PHONE-003', 'phone', 'Paris', '30', '192.168.3.0/24', '8'],

            // Points d'accès WiFi
            ['WIFI-AP-001', 'wifi', 'Paris', '92', '192.168.4.0/24', '9'],
            ['WIFI-AP-002', 'wifi', 'Lyon', '92', '192.168.4.0/24', '10'],

            // Caméras
            ['CAMERA-001', 'camera', 'Paris', '100', '192.168.5.0/24', '11'],
            ['CAMERA-002', 'camera', 'Paris', '100', '192.168.5.0/24', '12'],

            // Serveurs
            ['SERVER-PROD-001', 'server', 'Paris', '451', '192.168.6.0/24', '13'],
            ['SERVER-PROD-002', 'server', 'Paris', '451', '192.168.6.0/24', '14'],

            // IoT avec mélange de zones
            ['IOT-SENSOR-001', 'iot', 'Paris', '461', '192.168.7.0/24', '15'],
            ['IOT-SENSOR-002', 'iot', 'Lyon', '461', '192.168.7.0/24', '16'],
            ['IOT-SENSOR-003', 'iot', 'Lyon', '461', '192.168.7.0/24', '17'],

            // Équipements d'administration
            ['SWITCH-001', 'switch', 'Paris', '800', '192.168.8.0/24', '18'],
            ['SWITCH-002', 'switch', 'Lyon', '800', '192.168.8.0/24', '19']
        ];

        const ws = XLSX.utils.aoa_to_sheet(exampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Example');
        XLSX.writeFile(wb, 'exemple-migration-vlan.xlsx');
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Standardisation des VLANs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileUpload}
                            className="cursor-pointer w-3/4"
                        />
                        <Button onClick={generateExampleFile} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Télécharger exemple
                        </Button>
                    </div>

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

                    {migrationResults.length > 0 && (
                        <>
                            <div className="flex justify-end">
                                <Button onClick={exportMigrationPlan}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Exporter le plan
                                </Button>
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
                                                        <TableHead>{`Nombre d'appareils`}</TableHead>
                                                        <TableHead>VLAN Actuel</TableHead>
                                                        <TableHead>VLAN Suggéré</TableHead>
                                                        <TableHead>Nom du VLAN</TableHead>
                                                        <TableHead>Appareils concernés</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {subnetReorganization.map((reorg, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{reorg.originalSubnet}</TableCell>
                                                            <TableCell>{reorg.newSubnet}</TableCell>
                                                            <TableCell>{reorg.deviceCount}</TableCell>
                                                            <TableCell>
                                                                {reorg.devices[0]?.currentVlan || 'N/A'}
                                                            </TableCell>
                                                            <TableCell>{reorg.vlan}</TableCell>
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
};