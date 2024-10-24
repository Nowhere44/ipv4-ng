import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Network, Download, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Address4 } from 'ip-address';
import * as XLSX from 'xlsx';

interface SubnetRequirement {
    mask: number;
    count: number;
}

interface SubnetResult {
    network: string;
    mask: string;
    firstIP: string;
    lastIP: string;
    broadcast: string;
    size: number;
}

const SubnetSplitter = () => {
    const [baseIP, setBaseIP] = useState('10.110.10.0');
    const [requirements, setRequirements] = useState<SubnetRequirement[]>([]);
    const [results, setResults] = useState<SubnetResult[]>([]);
    const [error, setError] = useState('');

    // Liste des masques possibles
    const possibleMasks = Array.from({ length: 15 }, (_, i) => 16 + i);

    const isPrivateIP = (ip: string): boolean => {
        const parts = ip.split('.');
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);

        // Plages d'adresses privées selon RFC1918
        return (
            (first === 10) || // 10.0.0.0 - 10.255.255.255
            (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0 - 172.31.255.255
            (first === 192 && second === 168) // 192.168.0.0 - 192.168.255.255
        );
    };

    const isValidNetworkAddress = (ip: string, mask: number): boolean => {
        const addr = new Address4(`${ip}/${mask}`);
        return addr.startAddress().address === ip;
    };

    const calculateSubnets = () => {
        try {
            setError('');
            const newResults: SubnetResult[] = [];

            // Valider l'IP de base
            try {
                new Address4(baseIP);
            } catch {
                setError('Adresse IP de base invalide');
                return;
            }

            // Vérifier que c'est une adresse privée
            if (!isPrivateIP(baseIP)) {
                setError('Seules les adresses privées sont autorisées (10.x.x.x, 172.16-31.x.x, 192.168.x.x)');
                return;
            }

            // Vérifier que c'est une adresse réseau valide
            if (!isValidNetworkAddress(baseIP, 24)) {
                setError('L\'adresse IP doit être une adresse réseau valide');
                return;
            }

            // Vérifier qu'il y a des besoins
            if (requirements.length === 0) {
                setError('Ajoutez au moins un besoin en sous-réseau');
                return;
            }

            let currentIP = baseIP;
            const baseIPParts = baseIP.split('.');
            const startingThirdOctet = parseInt(baseIPParts[2]);

            // Calculer l'espace total nécessaire
            let totalSpaceNeeded = 0;
            for (const req of requirements) {
                totalSpaceNeeded += req.count * Math.pow(2, 32 - req.mask);
            }

            // Vérifier l'espace disponible dans la plage d'adresses
            const maxAvailableSpace = Math.pow(2, 24); // Pour un /8
            if (totalSpaceNeeded > maxAvailableSpace) {
                setError('Les besoins dépassent l\'espace disponible dans la plage');
                return;
            }

            // Trier par taille de masque (du plus grand au plus petit)
            const sortedRequirements = [...requirements].sort((a, b) => a.mask - b.mask);

            for (const req of sortedRequirements) {
                if (req.mask < 16 || req.mask > 30) {
                    setError('Les masques doivent être entre /16 et /30');
                    return;
                }

                const blockSize = Math.pow(2, 32 - req.mask);

                for (let i = 0; i < req.count; i++) {
                    try {
                        // Vérifier l'alignement du réseau
                        const addr = new Address4(`${currentIP}/${req.mask}`);
                        if (addr.startAddress().address !== currentIP) {
                            throw new Error('Mauvais alignement du réseau');
                        }

                        const networkAddress = addr.startAddress().address;
                        const broadcastAddress = addr.endAddress().address;

                        const firstUsable = networkAddress.split('.');
                        firstUsable[3] = (parseInt(firstUsable[3]) + 1).toString();

                        const lastUsable = broadcastAddress.split('.');
                        lastUsable[3] = (parseInt(lastUsable[3]) - 1).toString();

                        newResults.push({
                            network: networkAddress,
                            mask: `/${req.mask}`,
                            firstIP: firstUsable.join('.'),
                            lastIP: lastUsable.join('.'),
                            broadcast: broadcastAddress,
                            size: blockSize - 2
                        });

                        // Calculer la prochaine adresse IP de base
                        const nextIPParts = currentIP.split('.');
                        let value = parseInt(nextIPParts[3]) + blockSize;
                        nextIPParts[3] = (value % 256).toString();
                        if (value >= 256) {
                            value = parseInt(nextIPParts[2]) + Math.floor(value / 256);
                            nextIPParts[2] = (value % 256).toString();
                            if (value >= 256) {
                                value = parseInt(nextIPParts[1]) + Math.floor(value / 256);
                                nextIPParts[1] = (value % 256).toString();
                                if (value >= 256) {
                                    throw new Error('Dépassement de la plage d\'adresses');
                                }
                            }
                        }
                        currentIP = nextIPParts.join('.');

                        // Vérifier qu'on reste dans la même plage privée
                        if (!isPrivateIP(currentIP)) {
                            throw new Error('Dépassement de la plage d\'adresses privées');
                        }

                        // Vérifier qu'on ne redescend pas dans une plage déjà utilisée
                        const nextIPParsed = currentIP.split('.');
                        const nextThirdOctet = parseInt(nextIPParsed[2]);
                        if (nextThirdOctet < startingThirdOctet) {
                            throw new Error('Dépassement dans une plage déjà utilisée');
                        }

                    } catch (error) {
                        if (error instanceof Error) {
                            setError(`Erreur : ${error.message}`);
                        } else {
                            setError('Erreur inattendue lors du calcul');
                        }
                        return;
                    }
                }
            }

            setResults(newResults);
        } catch (error) {
            if (error instanceof Error) {
                setError(`Erreur lors du calcul des sous-réseaux : ${error.message}`);
            } else {
                setError('Erreur inattendue lors du calcul des sous-réseaux');
            }
        }
    };

    const addRequirement = () => {
        setRequirements([...requirements, { mask: 24, count: 1 }]);
    };

    const removeRequirement = (index: number) => {
        setRequirements(requirements.filter((_, i) => i !== index));
    };

    const updateRequirement = (index: number, field: keyof SubnetRequirement, value: number) => {
        const newRequirements = [...requirements];
        newRequirements[index] = {
            ...newRequirements[index],
            [field]: value
        };
        setRequirements(newRequirements);
    };

    const exportResults = (format: 'xlsx' | 'csv' | 'xml') => {
        if (!results.length) return;

        const exportData = results.map(result => ({
            Réseau: result.network,
            Masque: result.mask,
            'Première IP': result.firstIP,
            'Dernière IP': result.lastIP,
            Broadcast: result.broadcast,
            'Nombre d\'hôtes': result.size
        }));

        if (format === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sous-réseaux');
            XLSX.writeFile(wb, 'sous-reseaux.xlsx');
        } else if (format === 'csv') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sous-reseaux.csv';
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'xml') {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Subnets>\n';
            exportData.forEach((result) => {
                xml += '  <Subnet>\n';
                Object.entries(result).forEach(([key, value]) => {
                    xml += `    <${key}>${value}</${key}>\n`;
                });
                xml += '  </Subnet>\n';
            });
            xml += '</Subnets>';

            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sous-reseaux.xml';
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Network className="w-5 h-5" />
                    Découpage automatique de sous-réseaux
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Adresse IP de base</label>
                        <Input
                            value={baseIP}
                            onChange={(e) => setBaseIP(e.target.value)}
                            placeholder="ex: 10.110.10.0"
                        />
                    </div>
                    <Button onClick={calculateSubnets}>Calculer</Button>
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Besoins en sous-réseaux</h3>
                        <Button onClick={addRequirement} variant="outline" size="sm">
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Ajouter
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {requirements.map((req, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={req.count}
                                    onChange={(e) => updateRequirement(index, 'count', parseInt(e.target.value) || 0)}
                                    className="w-24"
                                    min="1"
                                />
                                <span>réseaux en</span>
                                <select
                                    value={req.mask}
                                    onChange={(e) => updateRequirement(index, 'mask', parseInt(e.target.value))}
                                    className="w-24 p-2 border rounded"
                                >
                                    {possibleMasks.map(mask => (
                                        <option key={mask} value={mask}>/{mask}</option>
                                    ))}
                                </select>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeRequirement(index)}
                                >
                                    <MinusCircle className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {results.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">Résultats</h3>
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
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Réseau</TableHead>
                                        <TableHead>Masque</TableHead>
                                        <TableHead>Première IP</TableHead>
                                        <TableHead>Dernière IP</TableHead>
                                        <TableHead>Broadcast</TableHead>
                                        <TableHead>Taille</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map((result, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-mono">{result.network}</TableCell>
                                            <TableCell>{result.mask}</TableCell>
                                            <TableCell className="font-mono">{result.firstIP}</TableCell>
                                            <TableCell className="font-mono">{result.lastIP}</TableCell>
                                            <TableCell className="font-mono">{result.broadcast}</TableCell>
                                            <TableCell>{result.size} hôtes</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SubnetSplitter;