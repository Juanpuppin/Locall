$ErrorActionPreference = 'Stop'

$out = Join-Path $PSScriptRoot 'cert.pfx'
if (Test-Path $out) {
    Write-Host "Certificado ja existe em $out"
    exit 0
}

$cert = New-SelfSignedCertificate `
    -DnsName 'localhost', 'ligacao.local' `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears(5) `
    -FriendlyName 'Ligacao Local'

$pwd = ConvertTo-SecureString -String 'ligacao-local' -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $out -Password $pwd | Out-Null

# Remove do repositorio de certificados do Windows; o app usa so o arquivo .pfx
Remove-Item ("Cert:\CurrentUser\My\" + $cert.Thumbprint)

Write-Host "Certificado gerado em $out"
