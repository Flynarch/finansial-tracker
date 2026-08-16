Add-Type -AssemblyName System.Drawing

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

    # Bar 1: rect x="15" y="65" width="18" height="20" rx="3" fill="#4C6B54"
    $b1 = New-Object System.Drawing.SolidBrush($c1)
    $g.FillRectangle($b1, [float](15 * $scale), [float](65 * $scale), [float](18 * $scale), [float](20 * $scale))
    $b1.Dispose()

    # Bar 2: rect x="41" y="50" width="18" height="35" rx="3" fill="#8AA68F"
    $b2 = New-Object System.Drawing.SolidBrush($c2)
    $g.FillRectangle($b2, [float](41 * $scale), [float](50 * $scale), [float](18 * $scale), [float](35 * $scale))
    $b2.Dispose()

    # Bar 3: rect x="67" y="30" width="18" height="55" rx="3" fill="#A15A42"
    $b3 = New-Object System.Drawing.SolidBrush($c3)
    $g.FillRectangle($b3, [float](67 * $scale), [float](30 * $scale), [float](18 * $scale), [float](55 * $scale))
    $b3.Dispose()

    # Apex cut: path d="M75,30 L85,30 L85,40 Z" fill="#F3EEE2"
    $pLight = New-Object System.Drawing.SolidBrush($cLight)
    $points = @(
        (New-Object System.Drawing.PointF([float](75 * $scale), [float](30 * $scale))),
        (New-Object System.Drawing.PointF([float](85 * $scale), [float](30 * $scale))),
        (New-Object System.Drawing.PointF([float](85 * $scale), [float](40 * $scale)))
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
