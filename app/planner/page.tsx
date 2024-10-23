'use client'

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, MinusCircle, Save } from 'lucide-react';

type CriticalityLevel = 'high' | 'medium' | 'low';

interface NetworkRequirement {
    id: string;
    site: string;
    description: string;
    currentSubnet?: string;
    hostsNeeded: number;
    suggestedSubnet?: string;
    vlan?: number;
    criticality: CriticalityLevel;
    error?: string;
}

const NetworkPlanner = () => {
    const [baseNetwork, setBaseNetwork] = useState('192.168.0.0/16');
    const [requirements, setRequirements] = useState<NetworkRequirement[]>([
        {
            id: '1',
            site: 'Paris',
            description: 'Réseau Production',
            currentSubnet: '192.168.1.0/24',
            hostsNeeded: 100,
            vlan: 10,
            criticality: 'high'
        }
    ]);
    const [globalError, setGlobalError] = useState('');

    // Validation d'une adresse IP
    const validateIPAddress = (ip: string): boolean => {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
        if (!ipRegex.test(ip)) return false;

        const parts = ip.split('.');
        return parts.every(part => {
            const num = parseInt(part);
            return num >= 0 && num <= 255;
        });
    };

    // Calcul optimisé du masque nécessaire
    const calculateRequiredMask = (hosts: number): number => {
        if (hosts <= 0) return 32;
        const bits = Math.ceil(Math.log2(hosts + 2));
        return Math.max(32 - bits, 16);
    };

    // Suggère un VLAN basé sur la criticité
    const suggestVLAN = (criticality: CriticalityLevel, existingVLANs: number[]): number => {
        const vlanRanges = {
            high: { start: 10, end: 29 },
            medium: { start: 30, end: 49 },
            low: { start: 50, end: 99 }
        };

        const range = vlanRanges[criticality];
        let vlan = range.start;

        while (vlan <= range.end && existingVLANs.includes(vlan)) {
            vlan++;
        }

        return vlan <= range.end ? vlan : range.start;
    };

    const calculateNetworkCapacity = (baseNetwork: string): number => {
        const cidr = parseInt(baseNetwork.split('/')[1]);
        return Math.pow(2, 32 - cidr) - 2; // -2 pour réseau et broadcast
    };

    // Suggère une nouvelle organisation des sous-réseaux
    const suggestReorganization = () => {
        setGlobalError('');

        if (!validateIPAddress(baseNetwork)) {
            setGlobalError('Réseau de base invalide');
            return;
        }

        // Vérification de la capacité
        const totalCapacity = calculateNetworkCapacity(baseNetwork);
        const totalRequired = requirements.reduce((sum, req) => sum + req.hostsNeeded, 0);

        if (totalRequired > totalCapacity) {
            setGlobalError(`Dépassement de capacité : ${totalRequired} hôtes requis pour ${totalCapacity} disponibles`);
            return;
        }

        try {
            const baseIP = baseNetwork.split('/')[0];
            const networkParts = baseIP.split('.').map(Number);
            const existingVLANs = requirements.map(req => req.vlan || 0);

            const updatedRequirements = [...requirements]
                .sort((a, b) => {
                    if (a.criticality === b.criticality) {
                        return (b.hostsNeeded || 0) - (a.hostsNeeded || 0);
                    }
                    const priority = { high: 3, medium: 2, low: 1 };
                    return priority[b.criticality] - priority[a.criticality];
                })
                .map(req => {
                    if (!req.hostsNeeded || req.hostsNeeded <= 0) {
                        return { ...req, error: "Nombre d'hôtes invalide" };
                    }

                    const mask = calculateRequiredMask(req.hostsNeeded);
                    const suggestedSubnet = `${networkParts.join('.')}/${mask}`;

                    // Suggérer un VLAN si non défini
                    const vlan = req.vlan || suggestVLAN(req.criticality, existingVLANs);
                    existingVLANs.push(vlan);

                    // Calculer la prochaine adresse réseau
                    networkParts[2] += Math.pow(2, 24 - mask);
                    if (networkParts[2] >= 256) {
                        networkParts[2] = 0;
                        networkParts[1] += 1;
                    }

                    return {
                        ...req,
                        suggestedSubnet,
                        vlan,
                        error: undefined
                    };
                });

            setRequirements(updatedRequirements);
        } catch {
            setGlobalError('Erreur lors de la réorganisation');
        }
    };


    const removeRequirement = (id: string) => {
        setRequirements(requirements.filter(req => req.id !== id));
    };

    const updateRequirement = (
        id: string,
        field: keyof NetworkRequirement,
        value: string | number
    ) => {
        setRequirements(requirements.map(req => {
            if (req.id === id) {
                if (field === 'hostsNeeded') {
                    const numValue = parseInt(String(value));
                    return {
                        ...req,
                        [field]: isNaN(numValue) ? 0 : Math.max(0, numValue)
                    };
                }

                if (field === 'criticality') {
                    // Vérifier que la valeur est bien une CriticalityLevel valide
                    const criticalityValue = value as CriticalityLevel;
                    if (criticalityValue !== 'high' && criticalityValue !== 'medium' && criticalityValue !== 'low') {
                        return req; // Ignorer les valeurs invalides
                    }

                    const existingVLANs = requirements
                        .filter(r => r.id !== id)
                        .map(r => r.vlan || 0);
                    const newVlan = suggestVLAN(criticalityValue, existingVLANs);

                    return {
                        ...req,
                        criticality: criticalityValue,
                        vlan: newVlan
                    };
                }

                if (field === 'vlan') {
                    const numValue = parseInt(String(value));
                    if (isNaN(numValue) || numValue < 1 || numValue > 4094) {
                        return {
                            ...req,
                            error: 'VLAN invalide (1-4094)'
                        };
                    }
                    return { ...req, vlan: numValue, error: undefined };
                }

                return { ...req, [field]: value, error: undefined };
            }
            return req;
        }));
    };

    const addRequirement = () => {
        const existingVLANs = requirements.map(req => req.vlan || 0);
        const newCriticality: CriticalityLevel = 'low';
        const suggestedVlan = suggestVLAN(newCriticality, existingVLANs);

        const newRequirement: NetworkRequirement = {
            id: Date.now().toString(),
            site: '',
            description: '',
            hostsNeeded: 0,
            vlan: suggestedVlan,
            criticality: newCriticality
        };

        setRequirements([...requirements, newRequirement]);
    };
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Planification des Sous-réseaux</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {globalError && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-md">
                        {globalError}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-1 block">Réseau de base</label>
                        <Input
                            value={baseNetwork}
                            onChange={(e) => setBaseNetwork(e.target.value)}
                            placeholder="ex: 192.168.0.0/16"
                        />
                    </div>
                    <Button
                        onClick={suggestReorganization}
                        className="mt-6"
                    >
                        Réorganiser
                    </Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Site</th>
                                <th className="px-4 py-2 text-left">Description</th>
                                <th className="px-4 py-2 text-left">VLAN</th>
                                <th className="px-4 py-2 text-left">Criticité</th>
                                <th className="px-4 py-2 text-left">Sous-réseau actuel</th>
                                <th className="px-4 py-2 text-left">Hôtes requis</th>
                                <th className="px-4 py-2 text-left">Suggestion</th>
                                <th className="px-4 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requirements.map((req) => (
                                <tr key={req.id} className={`border-t ${req.error ? 'bg-red-50' : ''}`}>
                                    <td className="px-4 py-2">
                                        <Input
                                            value={req.site}
                                            onChange={(e) => updateRequirement(req.id, 'site', e.target.value)}
                                            placeholder="Site"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <Input
                                            value={req.description}
                                            onChange={(e) => updateRequirement(req.id, 'description', e.target.value)}
                                            placeholder="Description"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <Input
                                            type="number"
                                            value={req.vlan || ''}
                                            onChange={(e) => updateRequirement(req.id, 'vlan', parseInt(e.target.value))}
                                            placeholder="VLAN"
                                            min="1"
                                            max="4094"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <select
                                            value={req.criticality}
                                            onChange={(e) => updateRequirement(req.id, 'criticality', e.target.value as 'high' | 'medium' | 'low')}
                                            className="w-full p-2 border rounded"
                                        >
                                            <option value="high">Haute</option>
                                            <option value="medium">Moyenne</option>
                                            <option value="low">Basse</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-2">
                                        <Input
                                            value={req.currentSubnet || ''}
                                            onChange={(e) => updateRequirement(req.id, 'currentSubnet', e.target.value)}
                                            placeholder="ex: 192.168.1.0/24"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <Input
                                            type="number"
                                            value={req.hostsNeeded}
                                            onChange={(e) => updateRequirement(req.id, 'hostsNeeded', e.target.value)}
                                            placeholder="Nombre d'hôtes"
                                            min="0"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="text-sm font-mono">
                                            {req.suggestedSubnet || '-'}
                                            {req.error && (
                                                <div className="text-red-500 text-xs">{req.error}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeRequirement(req.id)}
                                        >
                                            <MinusCircle className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between">
                    <Button onClick={addRequirement} variant="outline">
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Ajouter un réseau
                    </Button>
                    <Button variant="default">
                        <Save className="h-4 w-4 mr-2" />
                        Appliquer les changements
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default NetworkPlanner;