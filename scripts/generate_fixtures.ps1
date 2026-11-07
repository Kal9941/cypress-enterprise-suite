Add-Type -AssemblyName System.Drawing

# 1. Gera sample.jpg (Imagem visual real 800x600)
$bmp = New-Object System.Drawing.Bitmap 800, 600
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(24, 119, 242))

$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$fontTitle = New-Object System.Drawing.Font('Arial', 28, [System.Drawing.FontStyle]::Bold)
$fontSub = New-Object System.Drawing.Font('Arial', 18)

$g.DrawString('OmniCare Web - Anexo E2E', $fontTitle, $brush, 60, 180)
$g.DrawString('Imagem de Teste de Upload - WhatsApp Oficial', $fontSub, $brush, 60, 240)

$rect = New-Object System.Drawing.Rectangle 60, 300, 680, 180
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 3)
$g.DrawRectangle($pen, $rect)

$g.DrawString('Status: Entregue e Visualizavel', $fontSub, $brush, 80, 340)
$g.DrawString('Arquivo: sample.jpg (Visualizacao Real)', $fontSub, $brush, 80, 390)

$bmp.Save('c:\cypress-enterprise-suite\cypress\fixtures\4.atendimentos\anexos\minimos\sample.jpg', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose()
$bmp.Dispose()

Write-Host "sample.jpg criado com sucesso!"
