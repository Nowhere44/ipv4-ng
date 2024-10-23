import { DeviceForVLAN, StandardVLAN, VLANMigrationResult, DeviceType, SubnetReorganization, NetworkTransition } from './vlan-types';
import { STANDARD_VLANS } from './vlan-constants';


interface NetworkInfo {
    network: string;
    subnet: string;
    currentVlan: number;
    suggestedVlan: number;
    deviceCount: number;
    deviceTypes: string[];
    zones: string[];
}



export class VLANManager {
    private devices: DeviceForVLAN[] = [];

    // Méthodes de gestion des appareils
    addDevice(device: DeviceForVLAN) {
        this.devices.push(device);
    }

    setDevices(devices: DeviceForVLAN[]) {
        this.devices = devices;
    }

    clearDevices() {
        this.devices = [];
    }

    // Analyse des sous-réseaux
    analyzeNetworks(): NetworkInfo[] {
        const networks = new Map<string, DeviceForVLAN[]>();

        // Grouper les appareils par réseau
        this.devices.forEach(device => {
            if (device.network) {
                const devices = networks.get(device.network) || [];
                devices.push(device);
                networks.set(device.network, devices);
            }
        });

        return Array.from(networks.entries()).map(([network, devices]) => {
            const deviceTypes = [...new Set(devices.map(d => d.type))];
            const zones = [...new Set(devices.map(d => d.zone || 'Unknown'))];

            // Trouver le VLAN le plus approprié
            const suggestedVlan = this.determineBestVLANForNetwork(deviceTypes, zones);

            return {
                network,
                subnet: this.calculateSubnet(network),
                currentVlan: devices[0].currentVlan || 0,
                suggestedVlan: suggestedVlan.id,
                deviceCount: devices.length,
                deviceTypes,
                zones
            };
        });
    }

    // Suggestion de réorganisation des sous-réseaux


    private calculateSubnet(network: string): string {
        // Extraire le masque du réseau (ex: "192.168.1.0/24" -> "24")
        const [, mask] = network.split('/');
        return mask || '24';
    }

    private groupDevicesByType(devices: DeviceForVLAN[]): {
        type: string;
        devices: DeviceForVLAN[];
        zones: string[];
    }[] {
        const groups = new Map<string, DeviceForVLAN[]>();

        devices.forEach(device => {
            const type = device.type.toLowerCase();
            const groupDevices = groups.get(type) || [];
            groupDevices.push(device);
            groups.set(type, groupDevices);
        });

        return Array.from(groups.entries()).map(([type, devices]) => ({
            type,
            devices,
            zones: [...new Set(devices.map(d => d.zone || 'Unknown'))]
        }));
    }

    private determineBestVLANForNetwork(types: string[], zones: string[]): StandardVLAN {
        // Si tous les appareils sont du même type
        if (types.length === 1) {
            return this.determineAppropriateVLAN({
                type: types[0],
                zone: zones.includes('Paris') ? 'Paris' : zones[0]
            } as DeviceForVLAN);
        }

        // Si mélange de types
        const hasNonParis = zones.some(zone => zone.toLowerCase() !== 'paris');
        return STANDARD_VLANS.find(v => v.id === (hasNonParis ? 3 : 2))!;
    }

    // Détermine le VLAN approprié pour un appareil
    private determineAppropriateVLAN(device: DeviceForVLAN): StandardVLAN {
        const type = device.type.toLowerCase() as DeviceType;

        // Logique de détermination basée sur le type d'appareil
        switch (type) {
            case 'pc':
            case 'printer':
            case 'workstation':
                return this.assignDataVLAN(device);

            case 'wifi':
            case 'wireless':
                return this.assignWlanVLAN(device);

            case 'phone':
            case 'voip':
                return this.assignToIPVLAN(device);

            case 'camera':
            case 'surveillance':
                return STANDARD_VLANS.find(v => v.id === 100) || this.getDefaultVLAN();

            case 'server':
                return STANDARD_VLANS.find(v => v.id === 451) || this.getDefaultVLAN();

            case 'iot':
            case 'sensor':
                return STANDARD_VLANS.find(v => v.id === 461) || this.getDefaultVLAN();

            case 'switch':
            case 'admin':
                return STANDARD_VLANS.find(v => v.id === 800) || this.getDefaultVLAN();

            default:
                return STANDARD_VLANS.find(v => v.id === 461) || this.getDefaultVLAN(); // IOT par défaut
        }
    }

    private getDefaultVLAN(): StandardVLAN {
        return STANDARD_VLANS.find(v => v.id === 461)!;
    }

    // Gestion des VLANs spécifiques avec leurs extensions
    private assignDataVLAN(device: DeviceForVLAN): StandardVLAN {
        const mainVlan = STANDARD_VLANS.find(v => v.id === 2)!;
        const extensionVlan = STANDARD_VLANS.find(v => v.id === 3)!;

        if (device.zone && device.zone.toLowerCase() !== 'paris') {
            return extensionVlan;
        }

        const devicesInMainVlan = this.getDevicesInVLAN(mainVlan.id);

        if (devicesInMainVlan.length >= (mainVlan.maxDevices || 254)) {
            return extensionVlan;
        }
        return mainVlan;
    }

    private assignWlanVLAN(device: DeviceForVLAN): StandardVLAN {
        const mainVlan = STANDARD_VLANS.find(v => v.id === 92)!;
        const extensionVlan = STANDARD_VLANS.find(v => v.id === 93)!;

        if (device.zone && device.zone.toLowerCase() !== 'paris') {
            return extensionVlan;
        }

        const devicesInMainVlan = this.getDevicesInVLAN(mainVlan.id);

        if (devicesInMainVlan.length >= (mainVlan.maxDevices || 254)) {
            return extensionVlan;
        }
        return mainVlan;
    }

    private assignToIPVLAN(device: DeviceForVLAN): StandardVLAN {
        const mainVlan = STANDARD_VLANS.find(v => v.id === 810)!;
        const extensionVlan = STANDARD_VLANS.find(v => v.id === 811)!;

        if (device.zone && device.zone.toLowerCase() !== 'paris') {
            return extensionVlan;
        }

        const devicesInMainVlan = this.getDevicesInVLAN(mainVlan.id);

        if (devicesInMainVlan.length >= (mainVlan.maxDevices || 254)) {
            return extensionVlan;
        }
        return mainVlan;
    }

    private getDevicesInVLAN(vlanId: number): DeviceForVLAN[] {
        return this.devices.filter(d => d.currentVlan === vlanId);
    }

    // Génération du plan de migration
    generateMigrationPlan(): VLANMigrationResult[] {
        return this.devices.map(device => {
            const suggestedVlan = this.determineAppropriateVLAN(device);
            const hasConflict = this.checkDeviceConflict(device, suggestedVlan);

            return {
                device,
                suggestedVlan,
                hasConflict
            };
        });
    }

    // Vérifie les conflits pour un appareil spécifique
    private checkDeviceConflict(device: DeviceForVLAN, suggestedVlan: StandardVLAN): boolean {
        if (!suggestedVlan.maxDevices) return false;

        const devicesInSuggestedVlan = this.devices.filter(d =>
            d.id !== device.id && // Exclure l'appareil actuel
            (d.currentVlan === suggestedVlan.id || // Appareils déjà dans ce VLAN
                this.determineAppropriateVLAN(d).id === suggestedVlan.id) // Appareils qui seront migrés vers ce VLAN
        );

        return devicesInSuggestedVlan.length >= suggestedVlan.maxDevices;
    }

    // Vérifie tous les conflits potentiels
    checkConflicts(): string[] {
        const conflicts: string[] = [];
        const vlanUsage = new Map<number, number>();

        // Calculer l'utilisation prévue des VLANs après migration
        this.devices.forEach(device => {
            const suggestedVlan = this.determineAppropriateVLAN(device);
            const currentCount = vlanUsage.get(suggestedVlan.id) || 0;
            vlanUsage.set(suggestedVlan.id, currentCount + 1);
        });

        // Vérifier les limites
        vlanUsage.forEach((count, vlanId) => {
            const vlan = STANDARD_VLANS.find(v => v.id === vlanId);
            if (vlan?.maxDevices && count > vlan.maxDevices) {
                conflicts.push(
                    `VLAN ${vlanId} (${vlan.name}) : ${count} appareils prévus, dépasse la limite de ${vlan.maxDevices}`
                );
            }
        });

        // Vérifier les conflits de zone
        const devicesWithZones = this.devices.filter(d => d.zone);
        devicesWithZones.forEach(device => {
            const suggestedVlan = this.determineAppropriateVLAN(device);
            if (!suggestedVlan.isExtension && device.zone && device.zone.toLowerCase() !== 'paris') {
                conflicts.push(
                    `${device.name} (${device.zone}) devrait être dans un VLAN d'extension (_X)`
                );
            }
        });

        return conflicts;
    }

    // Export du plan de migration
    exportMigrationPlan(): string[][] {
        const migrationPlan = this.generateMigrationPlan();
        const reorganization = this.reorganizeSubnets();

        // Préparer les données d'export
        const exportData: string[][] = [
            // En-têtes
            [
                'Nom',
                'Type',
                'Zone',
                'VLAN Actuel',
                'VLAN Suggéré',
                'Nom du VLAN',
                'Description VLAN',
                'Réseau Actuel',
                'Nouveau Réseau',
                'Capacité Totale',
                'Capacité Utilisée',
                'Capacité Disponible',
                'Raison du Changement',
                'Conflit'
            ]
        ];

        // Combiner les données de migration et de réorganisation pour chaque appareil
        migrationPlan.forEach(({ device, suggestedVlan, hasConflict }) => {
            // Trouver les infos de réorganisation correspondantes
            const reorgInfo = reorganization.find(
                reorg => reorg.devices.some(d => d.id === device.id)
            );

            const row: string[] = [
                device.name || 'N/A',                                          // Nom
                device.type || 'N/A',                                         // Type
                device.zone || 'N/A',                                         // Zone
                device.currentVlan?.toString() || 'N/A',                      // VLAN Actuel
                suggestedVlan.id.toString(),                                  // VLAN Suggéré
                suggestedVlan.name || 'N/A',                                  // Nom du VLAN
                suggestedVlan.description || 'N/A',                           // Description VLAN
                device.network || 'N/A',                                      // Réseau Actuel
                reorgInfo?.newSubnet || 'N/A',                               // Nouveau Réseau
                (reorgInfo?.capacityInfo?.total || 0).toString(),            // Capacité Totale
                (reorgInfo?.capacityInfo?.used || 0).toString(),             // Capacité Utilisée
                (reorgInfo?.capacityInfo?.available || 0).toString(),        // Capacité Disponible
                reorgInfo?.reason || 'Pas de changement nécessaire',         // Raison du Changement
                hasConflict ? 'Oui' : 'Non'                                  // Conflit
            ];

            exportData.push(row);
        });

        // Ajouter une ligne récapitulative pour chaque sous-réseau
        reorganization.forEach(reorg => {
            const summaryRow: string[] = [
                'RÉSUMÉ RÉSEAU',                                             // Nom
                'N/A',                                                       // Type
                'N/A',                                                       // Zone
                'N/A',                                                       // VLAN Actuel
                reorg.vlan.toString(),                                      // VLAN Suggéré
                STANDARD_VLANS.find(v => v.id === reorg.vlan)?.name || 'N/A', // Nom du VLAN
                'Résumé du sous-réseau',                                    // Description VLAN
                reorg.originalSubnet || 'N/A',                              // Réseau Actuel
                reorg.newSubnet || 'N/A',                                   // Nouveau Réseau
                (reorg.capacityInfo?.total || 0).toString(),               // Capacité Totale
                (reorg.capacityInfo?.used || 0).toString(),                // Capacité Utilisée
                (reorg.capacityInfo?.available || 0).toString(),           // Capacité Disponible
                reorg.reason || 'N/A',                                     // Raison du Changement
                'N/A'                                                      // Conflit
            ];

            exportData.push(summaryRow);
        });

        return exportData;
    }

    // Statistiques sur la migration
    getMigrationStats() {
        const migrationPlan = this.generateMigrationPlan();
        const stats = {
            totalDevices: this.devices.length,
            devicesToMigrate: 0,
            conflictsCount: 0,
            vlanUsage: new Map<number, number>()
        };

        migrationPlan.forEach(({ device, suggestedVlan, hasConflict }) => {
            if (device.currentVlan !== suggestedVlan.id) {
                stats.devicesToMigrate++;
            }
            if (hasConflict) {
                stats.conflictsCount++;
            }

            const currentCount = stats.vlanUsage.get(suggestedVlan.id) || 0;
            stats.vlanUsage.set(suggestedVlan.id, currentCount + 1);
        });

        return stats;
    }

    reorganizeSubnets(): SubnetReorganization[] {
        const networkGroups = new Map<string, DeviceForVLAN[]>();
        const existingSubnets: string[] = [];  // Pour tracker tous les sous-réseaux

        // Grouper les appareils par réseau
        this.devices.forEach(device => {
            if (device.network) {
                const devices = networkGroups.get(device.network) || [];
                devices.push(device);
                networkGroups.set(device.network, devices);
                existingSubnets.push(device.network);
            }
        });

        const reorganizations: SubnetReorganization[] = [];
        const usedNetworks = new Set<string>();

        for (const [originalNetwork, devices] of networkGroups.entries()) {
            const devicesCount = devices.length;
            const suggestedBase = this.suggestBaseNetwork(devicesCount, originalNetwork);
            const requiredMask = this.calculateRequiredMask(devicesCount);
            const transition = this.validateNetworkTransition(
                originalNetwork,
                suggestedBase,
                devicesCount
            );

            let newSubnet = '';
            let reason = '';
            const [baseNetwork] = originalNetwork.split('/');

            if (transition) {
                newSubnet = `${suggestedBase}/${requiredMask}`;
                reason = transition.reason;
            } else {
                newSubnet = `${baseNetwork}/${requiredMask}`;
                reason = "Conservation du réseau existant avec optimisation du masque";
            }

            // Vérifier et ajuster le sous-réseau jusqu'à trouver un qui ne chevauche pas
            let attempts = 0;
            const maxAttempts = 256; // Éviter une boucle infinie

            while (
                (usedNetworks.has(newSubnet) ||
                    !this.validateSubnetAllocation(newSubnet, Array.from(usedNetworks))) &&
                attempts < maxAttempts
            ) {
                const [network, mask] = newSubnet.split('/');
                const nextNetwork = this.incrementNetwork(network);
                newSubnet = `${nextNetwork}/${mask}`;
                attempts++;
            }

            if (attempts >= maxAttempts) {
                throw new Error(`Impossible de trouver un sous-réseau disponible pour ${originalNetwork}`);
            }

            usedNetworks.add(newSubnet);

            const capacityInfo = {
                total: Math.pow(2, 32 - requiredMask) - 2,
                used: devicesCount,
                available: Math.pow(2, 32 - requiredMask) - 2 - devicesCount
            };

            reorganizations.push({
                originalSubnet: originalNetwork,
                newSubnet,
                deviceCount: devicesCount,
                vlan: this.determineAppropriateVLAN(devices[0]).id,
                devices,
                reason,
                capacityInfo
            });
        }

        return reorganizations;
    }
    private incrementNetwork(network: string): string {
        const parts = network.split('.').map(Number);
        for (let i = parts.length - 1; i >= 0; i--) {
            if (parts[i] < 255) {
                parts[i]++;
                break;
            } else {
                parts[i] = 0;
            }
        }
        return parts.join('.');
    }
    // Fonctions auxiliaires pour la gestion des adresses IP

    private ipToInt(ip: string): number {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }

    private intToIp(int: number): string {
        return [
            (int >>> 24) & 0xFF,
            (int >>> 16) & 0xFF,
            (int >>> 8) & 0xFF,
            int & 0xFF
        ].join('.');
    }

    private subnetsOverlap(net1: number, mask1: number, net2: number, mask2: number): boolean {
        const mask = mask1 < mask2 ? mask1 : mask2;
        const net1Masked = net1 >>> (32 - mask);
        const net2Masked = net2 >>> (32 - mask);
        return net1Masked === net2Masked;
    }

    private calculateRequiredMask(hostCount: number): number {
        const bitsNeeded = Math.ceil(Math.log2(hostCount + 2));
        const suggestedMask = 32 - bitsNeeded;

        // Déterminer la plage appropriée selon le nombre d'hôtes
        if (hostCount > 65534) {
            if (hostCount > 1048574) {
                // Plus que ce que peut gérer 172.16.x.x
                return Math.max(suggestedMask, 8); // Classe A
            } else {
                // La plage 172.16.0.0/12 suffit
                return Math.max(suggestedMask, 12); // Classe B
            }
        } else {
            // Peut rester en 192.168.x.x
            return Math.max(suggestedMask, 16); // Classe C
        }
    }

    private suggestBaseNetwork(hostCount: number, currentNetwork: string): string {
        const [currentBase] = currentNetwork.split('.');

        if (hostCount > 65534) {
            if (hostCount > 1048574) {
                return '10.0.0.0'; // Migration vers classe A
            }
            return '172.16.0.0'; // Migration vers classe B
        }

        // Maintenir la base actuelle si possible
        return currentBase === '192' ? '192.168.0.0' : currentNetwork;
    }

    private validateNetworkTransition(currentNetwork: string, newNetwork: string, hostCount: number): NetworkTransition | null {
        const [currentBase] = currentNetwork.split('.');
        const [newBase] = newNetwork.split('.');

        const getCurrentClass = (base: string): 'A' | 'B' | 'C' => {
            const baseNum = parseInt(base);
            if (baseNum >= 1 && baseNum <= 126) return 'A';
            if (baseNum >= 128 && baseNum <= 191) return 'B';
            return 'C';
        };

        const getMaxHosts = (networkClass: 'A' | 'B' | 'C'): number => {
            switch (networkClass) {
                case 'A': return 16777214;
                case 'B': return 1048574;
                case 'C': return 65534;
            }
        };

        const currentClass = getCurrentClass(currentBase);
        const suggestedClass = getCurrentClass(newBase);
        const maxHosts = getMaxHosts(currentClass);

        if (hostCount > maxHosts) {
            return {
                currentClass,
                suggestedClass,
                reason: `Migration nécessaire: ${hostCount} hôtes dépassent la capacité de classe ${currentClass} (${maxHosts} max)`,
                requiredHosts: hostCount,
                maxHosts
            };
        }

        return null;
    }

    private validateSubnetAllocation(newSubnet: string, existingSubnets: string[]): boolean {
        const [newNetwork, newMask] = newSubnet.split('/');
        const newNetInt = this.ipToInt(newNetwork);
        const newMaskNum = parseInt(newMask);

        return !existingSubnets.some(subnet => {
            const [existingNetwork, existingMask] = subnet.split('/');
            const existingNetInt = this.ipToInt(existingNetwork);
            const existingMaskNum = parseInt(existingMask);

            return this.subnetsOverlap(
                newNetInt,
                newMaskNum,
                existingNetInt,
                existingMaskNum
            );
        });
    }
}
