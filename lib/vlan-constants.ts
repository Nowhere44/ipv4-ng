import { StandardVLAN } from './vlan-types';

export const STANDARD_VLANS: StandardVLAN[] = [
    { id: 1, name: "DEFAULT", description: "VLAN par défaut, non utilisé" },
    { id: 2, name: "DATA", description: "Utilisateurs filaires et imprimantes filaires", maxDevices: 254 },
    {
        id: 3, name: "DATA_X", description: "Utilisateurs filaires et imprimantes filaires d'une autre zone géographique",
        isExtension: true, parentVlanId: 2
    },
    { id: 92, name: "WLAN_DATA", description: "Utilisateurs Wifi", maxDevices: 254 },
    {
        id: 93, name: "WLAN_DATA_X", description: "Utilisateurs wifi d'une autre zone géographique",
        isExtension: true, parentVlanId: 92
    },
    { id: 100, name: "VIDEO", description: "Système de vidéoprotection" },
    { id: 200, name: "CTRL_ACCES", description: "Badgeuses, portiques, serrures connectées..." },
    { id: 400, name: "NATIVE", description: "Vlan natif sur les interfaces trunk" },
    { id: 451, name: "SRV", description: "Serveurs locaux (interface de production)" },
    { id: 461, name: "IOT", description: "Tout élément non adapté à l'usage des autres VLANS existant" },
    { id: 800, name: "ADM", description: "Administration in band des switchs, wifi, ILO IDRAC, OXE, autres" },
    { id: 810, name: "TOIP_USER", description: "Utilisateurs ToIP", maxDevices: 254 },
    {
        id: 811, name: "TOIP_USER_X", description: "Utilisateurs ToIP d'une autre zone géographique",
        isExtension: true, parentVlanId: 810
    },
    { id: 820, name: "ICO_SIP", description: "Interconnexion Trunk SIP pour la ToIP" },
    { id: 900, name: "ICO_WAN", description: "Interconnexion router SD-WAN" },
    { id: 700, name: "ICO_INDUS", description: "Interconnexion avec les firewall du périmètre Indus" }
];