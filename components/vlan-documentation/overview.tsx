import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export const VLANOverview = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Standardisation des VLANs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <section>
                    <h3 className="text-lg font-medium">Objectif</h3>
                    <p className="mt-2">
                        {`Normalisation des VLANs selon les standards de l'entreprise avec une limite
                        de 15 VLANs pour améliorer la gestion et la sécurité du réseau.`}
                    </p>
                </section>

                <section>
                    <h3 className="text-lg font-medium">Principes de base</h3>
                    <ul className="list-disc pl-6 mt-2 space-y-2">
                        <li>Limite de 254 appareils par VLAN (/24)</li>
                        <li>Extension automatique vers VLAN_X si dépassement</li>
                        <li>Séparation par type de service et criticité</li>
                        <li>{`VLANs dédiés pour l'interconnexion (ICO)`}</li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-lg font-medium">Catégories principales</h3>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="border p-4 rounded">
                            <h4 className="font-medium">VLANs Utilisateurs</h4>
                            <ul className="list-disc pl-4 mt-2">
                                <li>DATA (2) - Filaire</li>
                                <li>WLAN_DATA (92) - WiFi</li>
                                <li>TOIP_USER (810) - Téléphonie</li>
                            </ul>
                        </div>
                        <div className="border p-4 rounded">
                            <h4 className="font-medium">VLANs Système</h4>
                            <ul className="list-disc pl-4 mt-2">
                                <li>VIDEO (100)</li>
                                <li>SRV (451)</li>
                                <li>ADM (800)</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </CardContent>
        </Card>
    );
};