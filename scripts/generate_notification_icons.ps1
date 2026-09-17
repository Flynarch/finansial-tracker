Add-Type -AssemblyName System.Drawing

function Draw-RoundedRectangle {
    param(
        [System.Drawing.Graphics]$g,
        [System.Drawing.Brush]$brush,
        [float]$x,
        [float]$y,
        [float]$width,
        [float]$height,
        [float]$radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    if ($d -gt $width) { $d = $width }
    if ($d -gt $height) { $d = $height }
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $width - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $width - $d, $y + $height - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $height - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
    $path.Dispose()
}

function Generate-LargeNotificationIcon {
    param(
        [int]$size,
        [string]$outputPath
    )

    # 4x supersampling for ultra-crisp anti-aliasing
    $scaleFactor = 4
    $hiResSize = $size * $scaleFactor
    $bmp = New-Object System.Drawing.Bitmap($hiResSize, $hiResSize)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#18221B")
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#4C6B54")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#8AA68F")
    $c3 = [System.Drawing.ColorTranslator]::FromHtml("#A15A42")
    $cLight = [System.Drawing.ColorTranslator]::FromHtml("#F3EEE2")

    # Full-bleed brand dark forest background: 100% immune to OS circular/squircle mask clipping
    $g.Clear($bgColor)

    # Scale logo into circular safe zone (62% of diameter)
    $logoRatio = 0.62
    $logoSize = $hiResSize * $logoRatio
    $offsetX = ($hiResSize - $logoSize) / 2.0
    $offsetY = ($hiResSize - $logoSize) / 2.0

    # Base coordinates on standard 100x100 viewBox
    $s = $logoSize / 100.0

    # Bar 1: x="15" y="65" width="18" height="20" rx="4"
    $b1 = New-Object System.Drawing.SolidBrush($c1)
    Draw-RoundedRectangle -g $g -brush $b1 -x ($offsetX + 15 * $s) -y ($offsetY + 65 * $s) -width (18 * $s) -height (20 * $s) -radius (4 * $s)
    $b1.Dispose()

    # Bar 2: x="41" y="50" width="18" height="35" rx="4"
    $b2 = New-Object System.Drawing.SolidBrush($c2)
    Draw-RoundedRectangle -g $g -brush $b2 -x ($offsetX + 41 * $s) -y ($offsetY + 50 * $s) -width (18 * $s) -height (35 * $s) -radius (4 * $s)
    $b2.Dispose()

    # Bar 3: x="67" y="30" width="18" height="55" rx="4"
    $b3 = New-Object System.Drawing.SolidBrush($c3)
    Draw-RoundedRectangle -g $g -brush $b3 -x ($offsetX + 67 * $s) -y ($offsetY + 30 * $s) -width (18 * $s) -height (55 * $s) -radius (4 * $s)
    $b3.Dispose()

    # Apex Triangle: path d="M74,30 L85,30 L85,41 Z" fill="#F3EEE2"
    $pLight = New-Object System.Drawing.SolidBrush($cLight)
    $triPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pt1 = New-Object System.Drawing.PointF([float]($offsetX + 74 * $s), [float]($offsetY + 30 * $s))
    $pt2 = New-Object System.Drawing.PointF([float]($offsetX + 85 * $s), [float]($offsetY + 30 * $s))
    $pt3 = New-Object System.Drawing.PointF([float]($offsetX + 85 * $s), [float]($offsetY + 41 * $s))
    $triPath.AddPolygon(@($pt1, $pt2, $pt3))
    $g.FillPath($pLight, $triPath)
    $triPath.Dispose()
    $pLight.Dispose()

    $g.Dispose()

    # Downsample with HighQualityBicubic for silky anti-aliased output
    $finalBmp = New-Object System.Drawing.Bitmap($size, $size)
    $finalG = [System.Drawing.Graphics]::FromImage($finalBmp)
    $finalG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $finalG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $finalG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $finalG.DrawImage($bmp, 0, 0, $size, $size)
    $finalG.Dispose()
    $bmp.Dispose()

    # Save PNG
    $dir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $finalBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $finalBmp.Dispose()
    Write-Output "Generated: $outputPath ($size x $size)"
}

$baseRes = "android/app/src/main/res"

$densities = @(
    @{ folder = "drawable"; size = 192 },
    @{ folder = "drawable-mdpi"; size = 48 },
    @{ folder = "drawable-hdpi"; size = 72 },
    @{ folder = "drawable-xhdpi"; size = 96 },
    @{ folder = "drawable-xxhdpi"; size = 144 },
    @{ folder = "drawable-xxxhdpi"; size = 192 }
)

foreach ($d in $densities) {
    $outPath = Join-Path (Join-Path $baseRes $d.folder) "ic_fintrack_large.png"
    Generate-LargeNotificationIcon -size $d.size -outputPath $outPath
}

Write-Output "All Android large notification icons generated successfully!"
