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

function Draw-FinTrackIcon {
    param(
        [int]$width,
        [int]$height,
        [bool]$isRound = $false,
        [bool]$isForegroundOnly = $false,
        [string]$outputPath
    )

    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#18221B")
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#4C6B54")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#8AA68F")
    $c3 = [System.Drawing.ColorTranslator]::FromHtml("#A15A42")
    $cLight = [System.Drawing.ColorTranslator]::FromHtml("#F3EEE2")

    if (-not $isForegroundOnly) {
        if ($isRound) {
            $g.Clear([System.Drawing.Color]::Transparent)
            $brushBg = New-Object System.Drawing.SolidBrush($bgColor)
            $g.FillEllipse($brushBg, 0, 0, $width, $height)
            $brushBg.Dispose()
        } else {
            $g.Clear($bgColor)
        }
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    # Scaling factor based on standard 100x100 viewbox
    $scale = $width / 100.0
    if ($isForegroundOnly) {
        # Center in 108dp viewport (safe zone 72/108 = 0.667)
        $scale = ($width * 0.72) / 100.0
        $offsetX = ($width - (100.0 * $scale)) / 2.0
        $offsetY = ($height - (100.0 * $scale)) / 2.0
        $g.TranslateTransform($offsetX, $offsetY)
    }

    # Bar 1: rect x="15" y="65" width="18" height="20" rx="4"
    $b1 = New-Object System.Drawing.SolidBrush($c1)
    Draw-RoundedRectangle -g $g -brush $b1 -x (15 * $scale) -y (65 * $scale) -width (18 * $scale) -height (20 * $scale) -radius (4 * $scale)
    $b1.Dispose()

    # Bar 2: rect x="41" y="50" width="18" height="35" rx="4"
    $b2 = New-Object System.Drawing.SolidBrush($c2)
    Draw-RoundedRectangle -g $g -brush $b2 -x (41 * $scale) -y (50 * $scale) -width (18 * $scale) -height (35 * $scale) -radius (4 * $scale)
    $b2.Dispose()

    # Bar 3: rect x="67" y="30" width="18" height="55" rx="4"
    $b3 = New-Object System.Drawing.SolidBrush($c3)
    Draw-RoundedRectangle -g $g -brush $b3 -x (67 * $scale) -y (30 * $scale) -width (18 * $scale) -height (55 * $scale) -radius (4 * $scale)
    $b3.Dispose()

    # Apex cut: path d="M74,30 L85,30 L85,41 Z" fill="#F3EEE2"
    $pLight = New-Object System.Drawing.SolidBrush($cLight)
    $points = @(
        (New-Object System.Drawing.PointF([float](74 * $scale), [float](30 * $scale))),
        (New-Object System.Drawing.PointF([float](85 * $scale), [float](30 * $scale))),
        (New-Object System.Drawing.PointF([float](85 * $scale), [float](41 * $scale)))
    )
    $g.FillPolygon($pLight, $points)
    $pLight.Dispose()

    $g.Dispose()
    
    # Ensure directory exists
    $dir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $outputPath"
}

$baseRes = "android/app/src/main/res"

$densities = @(
    @{ name = "mipmap-mdpi"; size = 48; fgSize = 108 },
    @{ name = "mipmap-hdpi"; size = 72; fgSize = 162 },
    @{ name = "mipmap-xhdpi"; size = 96; fgSize = 216 },
    @{ name = "mipmap-xxhdpi"; size = 144; fgSize = 324 },
    @{ name = "mipmap-xxxhdpi"; size = 192; fgSize = 432 }
)

foreach ($d in $densities) {
    $folder = Join-Path $baseRes $d.name
    Draw-FinTrackIcon -width $d.size -height $d.size -isRound $false -isForegroundOnly $false -outputPath (Join-Path $folder "ic_launcher.png")
    Draw-FinTrackIcon -width $d.size -height $d.size -isRound $true -isForegroundOnly $false -outputPath (Join-Path $folder "ic_launcher_round.png")
    Draw-FinTrackIcon -width $d.fgSize -height $d.fgSize -isRound $false -isForegroundOnly $true -outputPath (Join-Path $folder "ic_launcher_foreground.png")
}

Write-Output "All Android launcher icons generated successfully!"
