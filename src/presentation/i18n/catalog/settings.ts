/** Texts of the Settings dialog. */
export const en = {
  title: 'Settings',
  appearance: 'Appearance',
  pdfAlwaysLight: 'The PDF is always generated in light mode, ready to print.',
  languageHint: 'The PDF language is chosen when exporting. Native date fields switch format after restarting the app.',
  issuerTitle: 'Your details for quotes',
  issuerHint: 'They appear on the cover and in the footer of the PDFs.',
  issuerName: 'Name or company',
  taxId: 'Tax ID',
  address: 'Address',
  email: 'Email',
  phone: 'Phone',
  website: 'Website',
  logoAlt: 'Logo',
  noLogo: 'No logo',
  changeLogo: 'Change logo',
  chooseLogo: 'Choose logo',
  data: 'Data',
  openFolder: 'Open folder',
  portableNote: 'Portable version: the data travels with the .exe. ',
  dataNote: (version: string) => `Each project is a JSON file with a daily backup. Version ${version}.`,
  saved: 'Settings saved'
}

// i18n:es-start
export const es: typeof en = {
  title: 'Ajustes',
  appearance: 'Apariencia',
  pdfAlwaysLight: 'El PDF siempre se genera en claro, listo para imprimir.',
  languageHint: 'El idioma del PDF se elige al exportar. Los campos de fecha nativos cambian de formato al reiniciar la app.',
  issuerTitle: 'Tus datos para los presupuestos',
  issuerHint: 'Aparecen en la portada y el pie de página de los PDF.',
  issuerName: 'Nombre o empresa',
  taxId: 'NIF / CIF',
  address: 'Dirección',
  email: 'Email',
  phone: 'Teléfono',
  website: 'Web',
  logoAlt: 'Logo',
  noLogo: 'Sin logo',
  changeLogo: 'Cambiar logo',
  chooseLogo: 'Elegir logo',
  data: 'Datos',
  openFolder: 'Abrir carpeta',
  portableNote: 'Versión portable: los datos viajan junto al .exe. ',
  dataNote: (version) => `Cada proyecto es un archivo JSON con copia de seguridad diaria. Versión ${version}.`,
  saved: 'Ajustes guardados'
}
// i18n:es-end
