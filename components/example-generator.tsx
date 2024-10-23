import * as XLSX from 'xlsx';

export const generateExampleFile = () => {
    const data = [
        ['Site', 'IP', 'Description'],
        ['Paris', '192.168.0.0/21', 'Réseau Production'],
        ['Paris', '192.168.0.0/18', 'Réseau Test'],
        ['', '192.168.3.0/24', 'Réseau Sans Site'],
        ['Lyon', '10.0.0.0/24', 'Réseau Principal'],
        ['Lyon', '10.0.1.0/24', 'Réseau Backup'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Example');
    XLSX.writeFile(wb, 'exemple-format.xlsx');
};