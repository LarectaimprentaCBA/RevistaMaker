Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Drawing.Drawing2D

$buildDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pngPath = Join-Path $buildDir 'icon-256.png'

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Fondo: gradiente magenta -> violeta para distinguir de PrintLayout (que es naranja default)
$rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
$c1 = [System.Drawing.Color]::FromArgb(255, 219, 39, 119)   # magenta
$c2 = [System.Drawing.Color]::FromArgb(255, 91, 33, 182)    # violeta
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
$g.FillRectangle($brush, 0, 0, $size, $size)
$brush.Dispose()

# Sombra suave detras de la revista
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
$g.FillEllipse($shadowBrush, 36, 200, 184, 26)
$shadowBrush.Dispose()

# Revista abierta: dos rectangulos blancos centrados, con un "lomo" central
$pageW = 88
$pageH = 130
$gap = 4
$totalW = $pageW * 2 + $gap
$startX = [int](($size - $totalW) / 2)
$startY = [int](($size - $pageH) / 2) - 8

$pageBrush = [System.Drawing.Brushes]::White
$g.FillRectangle($pageBrush, $startX, $startY, $pageW, $pageH)
$g.FillRectangle($pageBrush, $startX + $pageW + $gap, $startY, $pageW, $pageH)

# Borde sutil
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 0, 0, 0), 1)
$g.DrawRectangle($borderPen, $startX, $startY, $pageW, $pageH)
$g.DrawRectangle($borderPen, $startX + $pageW + $gap, $startY, $pageW, $pageH)
$borderPen.Dispose()

# Lineas que simulan texto/imagenes en las paginas
$lineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 219, 39, 119))
$g.FillRectangle($lineBrush, $startX + 10, $startY + 12, $pageW - 20, 28)  # imagen tope izq
$lineBrush.Dispose()

$grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 200, 200, 200))
for ($i = 0; $i -lt 4; $i++) {
    $y = $startY + 50 + $i * 12
    $g.FillRectangle($grayBrush, $startX + 10, $y, $pageW - 20, 4)
}

$lineBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 91, 33, 182))
$g.FillRectangle($lineBrush2, $startX + $pageW + $gap + 10, $startY + 12, $pageW - 20, 28)
$lineBrush2.Dispose()

for ($i = 0; $i -lt 4; $i++) {
    $y = $startY + 50 + $i * 12
    $g.FillRectangle($grayBrush, $startX + $pageW + $gap + 10, $y, $pageW - 20, 4)
}
$grayBrush.Dispose()

# Marca de pliegue (linea central)
$foldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 0, 0, 0), 1)
$g.DrawLine($foldPen, $startX + $pageW + 2, $startY, $startX + $pageW + 2, $startY + $pageH)
$foldPen.Dispose()

$g.Dispose()
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "PNG generado: $pngPath"
