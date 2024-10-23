import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { STANDARD_VLANS } from '@/lib/vlan-constants';

export const VLANStandards = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Standards VLAN</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    VLAN ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Nom
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Description
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Limite
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {STANDARD_VLANS.map((vlan) => (
                                <tr key={vlan.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{vlan.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{vlan.name}</td>
                                    <td className="px-6 py-4">{vlan.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {vlan.maxDevices || 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};