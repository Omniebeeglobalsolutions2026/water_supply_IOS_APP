Add-Type -AssemblyName System.Drawing;

$srcPath = "C:\Users\ADMIN\.gemini\antigravity\brain\fc83e726-92e5-455f-9183-dda753e7696f\.user_uploaded\media_1794808663202_52920140.jpg";
$outDir = "C:\Users\ADMIN\Desktop\Mobile_Application\water_supply_management\frontend\assets\trucks";

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$capacities = @(
    @{ Key = "base"; Label = "" },
    @{ Key = "100"; Label = "100L" },
    @{ Key = "250"; Label = "250L" },
    @{ Key = "500"; Label = "500L" },
    @{ Key = "1000"; Label = "1000L" },
    @{ Key = "1500"; Label = "1500L" },
    @{ Key = "2000"; Label = "2000L" },
    @{ Key = "3000"; Label = "3000L" },
    @{ Key = "4000"; Label = "4000L" },
    @{ Key = "5000"; Label = "5000L" },
    @{ Key = "6000"; Label = "6000L" },
    @{ Key = "7000"; Label = "7000L" },
    @{ Key = "8000"; Label = "8000L" },
    @{ Key = "9000"; Label = "9000L" },
    @{ Key = "10000"; Label = "10000L" },
    @{ Key = "12000"; Label = "12000L" }
);

foreach ($item in $capacities) {
    $bytes = [System.IO.File]::ReadAllBytes($srcPath);
    $ms = New-Object System.IO.MemoryStream($bytes, $false);
    $src = [System.Drawing.Bitmap]::FromStream($ms);

    # Crop tightly to frame the truck on clean white background
    $cropRect = New-Object System.Drawing.Rectangle(50, 230, 924, 540);
    $targetW = 640;
    $targetH = 374;
    $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH);
    $g = [System.Drawing.Graphics]::FromImage($bmp);
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit;

    $destRect = New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH);
    $g.DrawImage($src, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel);

    $label = $item.Label;
    if ($label -ne "") {
        # Tank center is at X=515, Y=144 in 640x374 coordinates
        $centerX = 515.0;
        $centerY = 144.0;

        # Increased font size for maximum legibility on mobile cards
        $fontSize = if ($label.Length -gt 5) { 33.0 } else { 38.0 };
        $font = New-Object System.Drawing.Font("Segoe UI", [float]$fontSize, [System.Drawing.FontStyle]::Bold);
        $fmt = New-Object System.Drawing.StringFormat;
        $fmt.Alignment = [System.Drawing.StringAlignment]::Center;
        $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center;

        # Subtle soft shadow for depth against the cylindrical white tank
        $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 10, 40, 80));
        $g.DrawString($label, $font, $shadowBrush, [float]($centerX + 1.2), [float]($centerY + 1.2), $fmt);
        $shadowBrush.Dispose();

        # Deep Vibrant Brand Blue (#0751A8)
        $blueBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 7, 81, 168));
        $g.DrawString($label, $font, $blueBrush, [float]$centerX, [float]$centerY, $fmt);
        $blueBrush.Dispose();

        $font.Dispose();
        $fmt.Dispose();
    }

    $fileName = "truck_$($item.Key).png";
    $destFile = Join-Path $outDir $fileName;

    $saveMs = New-Object System.IO.MemoryStream;
    $bmp.Save($saveMs, [System.Drawing.Imaging.ImageFormat]::Png);
    [System.IO.File]::WriteAllBytes($destFile, $saveMs.ToArray());

    $saveMs.Dispose();
    $g.Dispose();
    $bmp.Dispose();
    $src.Dispose();
    $ms.Dispose();
    Write-Host "Generated: $fileName";
}

Write-Host "All tanker images successfully generated with white background and large blue text!";
