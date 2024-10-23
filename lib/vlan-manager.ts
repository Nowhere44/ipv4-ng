import { DeviceForVLAN, StandardVLAN, VLANMigrationResult, DeviceType } from './vlan-types';
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

interface SubnetAnalysis {
    originalSubnet: string;
    suggestedSubnets: {
        network: string;
        vlan: number;
        deviceCount: number;
        deviceTypes: string[];
    }[];
}

interface SubnetReorganization {
    originalSubnet: string;    // Sous-réseau actuel
    newSubnet: string;        // Nouveau sous-réseau suggéré
    deviceCount: number;      // Nombre d'appareils
    vlan: number;            // VLAN suggéré
    devices: DeviceForVLAN[]; // Appareils concernés
}

export class VLANManager {

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
    suggestNetworkReorganization(): SubnetAnalysis[] {
        const networks = this.analyzeNetworks();
        return networks.map(network => {
            const devices = this.devices.filter(d => d.network === network.network);

            // Regrouper par type d'appareil
            const deviceGroups = this.groupDevicesByType(devices);

            // Suggérer des sous-réseaux pour chaque groupe
            const suggestedSubnets = deviceGroups.map(group => {
                const vlan = this.determineBestVLANForNetwork([group.type], group.zones);
                return {
                    network: this.suggestSubnet(group.devices.length),
                    vlan: vlan.id,
                    deviceCount: group.devices.length,
                    deviceTypes: [group.type]
                };
            });

            return {
                originalSubnet: network.network,
                suggestedSubnets
            };
        });
    }

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
            const devices = groups.get(type) || [];
            devices.push(device);
            groups.set(type, devices);
        });

        return Array.from(groups.entries()).map(([type, devices]) => ({
            type,
            devices,
            zones: [...new Set(devices.map(d => d.zone || 'Unknown'))]
        }));
    }

    private suggestSubnet(deviceCount: number): string {
        // Calculer la taille du sous-réseau nécessaire
        const hostBits = Math.ceil(Math.log2(deviceCount + 2)); // +2 pour réseau et broadcast
        const mask = 32 - hostBits;

        // Pour l'exemple, on utilise une plage d'adresses fictive
        return `10.0.0.0/${mask}`;
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
        return [
            // En-têtes
            ['Nom', 'Type', 'Zone', 'VLAN Actuel', 'VLAN Suggéré', 'Nom du VLAN', 'Description', 'Conflit'],
            // Données
            ...migrationPlan.map(({ device, suggestedVlan, hasConflict }) => [
                device.name || '',
                device.type || '',
                device.zone || 'N/A',
                (device.currentVlan || 'N/A').toString(),
                suggestedVlan.id.toString(),
                suggestedVlan.name,
                suggestedVlan.description,
                hasConflict ? 'Oui' : 'Non'
            ])
        ];
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

    private isValidDeviceType(type: string): type is DeviceType {
        const validTypes: DeviceType[] = [
            'pc', 'printer', 'workstation', 'wifi', 'wireless',
            'phone', 'voip', 'camera', 'surveillance', 'server',
            'iot', 'sensor', 'switch', 'admin'
        ];
        return validTypes.includes(type as DeviceType);
    }
    // Dans vlan-manager.ts
    // Dans reorganizeSubnets(), modifions la façon dont nous calculons le nouveau sous-réseau
    reorganizeSubnets(): SubnetReorganization[] {
        const networkGroups = new Map<string, DeviceForVLAN[]>();

        // Grouper par réseau actuel
        this.devices.forEach(device => {
            if (device.network) {
                const devices = networkGroups.get(device.network) || [];
                devices.push(device);
                networkGroups.set(device.network, devices);
            }
        });

        // Obtenir la base du premier réseau pour le remaniement
        const baseNetwork = this.devices[0]?.network?.split('/')[0] || '192.168.0.0';
        const baseOctets = baseNetwork.split('.').map(Number);
        const baseFirst3Octets = baseOctets.slice(0, 3).join('.');
        let nextSubnet = 0;

        // Traiter les réseaux du plus grand au plus petit
        const sortedNetworks = Array.from(networkGroups.entries())
            .sort((a, b) => b[1].length - a[1].length);

        const reorganizations: SubnetReorganization[] = [];

        sortedNetworks.forEach(([originalNetwork, devices]) => {
            const devicesCount = devices.length;
            // Calculer le masque approprié basé sur le nombre d'appareils
            const newMask = this.calculateRequiredMask(devicesCount);

            // Créer le nouveau sous-réseau en utilisant la même base
            const newNetwork = `${baseFirst3Octets}.${nextSubnet}/${newMask}`;

            // Calculer l'incrément pour le prochain sous-réseau
            const increment = Math.pow(2, 32 - newMask);
            nextSubnet += increment;

            // Déterminer le VLAN basé sur le premier appareil
            const dominantType = devices[0].type as DeviceType;
            const vlan = this.determineAppropriateVLAN({
                type: dominantType,
                id: '0',
                name: '',
                zone: devices[0].zone
            }).id;

            reorganizations.push({
                originalSubnet: originalNetwork,
                newSubnet: newNetwork,
                deviceCount: devicesCount,
                vlan,
                devices
            });
        });

        return reorganizations;
    }

    private calculateRequiredMask(hostCount: number): number {
        // Calculer le masque optimal pour le nombre d'hôtes
        const bitsNeeded = Math.ceil(Math.log2(hostCount + 2)); // +2 pour le réseau et broadcast
        const mask = Math.min(32 - bitsNeeded, 30); // On limite à /30 minimum
        return Math.max(mask, 24); // On ne dépasse pas /24
    }

    // Méthode pour incrémenter l'adresse réseau
    private incrementNetwork(network: string, mask: number): string {
        const octets = network.split('.').map(Number);
        const increment = Math.pow(2, 32 - mask);

        let value = (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
        value += increment;

        return [
            (value >> 24) & 255,
            (value >> 16) & 255,
            (value >> 8) & 255,
            value & 255
        ].join('.');
    }
}