param([ValidateSet('palette','pixelize','check')]$Mode)
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
public static class PixelArt {
  static double Kernel(double x) {
    x=Math.Abs(x);
    if(x<1e-8)return 1;
    if(x>=3)return 0;
    return Math.Sin(Math.PI*x)*Math.Sin(Math.PI*x/3)/(Math.PI*Math.PI*x*x/3);
  }
  public static string[] Palette(string[] paths) {
    var samples=new List<Color>();
    foreach(var path in paths) using(var img=new Bitmap(path)) {
      for(int y=0;y<img.Height;y+=13)for(int x=0;x<img.Width;x+=13) {
        var p=img.GetPixel(x,y);if(p.A>=128)samples.Add(p);
      }
    }
    var boxes=new List<List<Color>> { samples };
    while(boxes.Count<48) {
      int pick=-1, channel=0;double best=-1;
      for(int i=0;i<boxes.Count;i++){
        var box=boxes[i];if(box.Count<2)continue;
        for(int c=0;c<3;c++){
          int lo=255,hi=0;foreach(var p in box){int v=Value(p,c);lo=Math.Min(lo,v);hi=Math.Max(hi,v);}
          double score=(hi-lo)*Math.Sqrt(box.Count);if(score>best){best=score;pick=i;channel=c;}
        }
      }
      var chosen=boxes[pick];chosen.Sort((a,b)=>Value(a,channel).CompareTo(Value(b,channel)));
      int half=chosen.Count/2;boxes[pick]=chosen.GetRange(0,half);boxes.Add(chosen.GetRange(half,chosen.Count-half));
    }
    var result=new List<string>();
    foreach(var box in boxes){
      int r=0,g=0,b=0;foreach(var c in box){r+=c.R;g+=c.G;b+=c.B;}
      result.Add(String.Format("#{0:X2}{1:X2}{2:X2}",r/box.Count,g/box.Count,b/box.Count));
    }
    return result.ToArray();
  }
  static int Value(Color c,int channel){return channel==0?c.R:channel==1?c.G:c.B;}
  public static void Render(string source,string output,int width,int height,string[] colors) {
    var palette=Array.ConvertAll(colors,ColorTranslator.FromHtml);
    int[,] bayer={{0,8,2,10},{12,4,14,6},{3,11,1,9},{15,7,13,5}};
    using(var input=new Bitmap(source)) using(var dest=new Bitmap(width,height,PixelFormat.Format32bppArgb)){
      double sx=Math.Max(1,input.Width/(double)width),sy=Math.Max(1,input.Height/(double)height);
      for(int y=0;y<height;y++)for(int x=0;x<width;x++){
        double cx=(x+.5)*input.Width/width-.5,cy=(y+.5)*input.Height/height-.5;
        double r=0,g=0,b=0,opacity=0,total=0;
        for(int iy=Math.Max(0,(int)Math.Ceiling(cy-3*sy));iy<=Math.Min(input.Height-1,(int)Math.Floor(cy+3*sy));iy++){
          double wy=Kernel((iy-cy)/sy);
          for(int ix=Math.Max(0,(int)Math.Ceiling(cx-3*sx));ix<=Math.Min(input.Width-1,(int)Math.Floor(cx+3*sx));ix++){
            double w=wy*Kernel((ix-cx)/sx);var p=input.GetPixel(ix,iy);double alpha=p.A/255.0;
            total+=w;opacity+=w*alpha;r+=w*alpha*p.R;g+=w*alpha*p.G;b+=w*alpha*p.B;
          }
        }
        if(opacity/total<.5){dest.SetPixel(x,y,Color.Transparent);continue;}
        double d=(bayer[y%4,x%4]-7.5)*.85;
        r=r/opacity+d;g=g/opacity+d;b=b/opacity+d;
        Color best=palette[0];double dist=Double.MaxValue;
        foreach(var p in palette){
          double dr=r-p.R,dg=g-p.G,db=b-p.B;
          double score=dr*dr*.25+dg*dg*.55+db*db*.20;
          if(score<dist){dist=score;best=p;}
        }
        dest.SetPixel(x,y,best);
      }
      dest.Save(output,ImageFormat.Png);
    }
  }
  public static string Check(string path,int width,int height,string[] colors){
    var accepted=new HashSet<int>();foreach(var s in colors)accepted.Add(ColorTranslator.FromHtml(s).ToArgb());
    using(var img=new Bitmap(path)){
      if(img.Width!=width||img.Height!=height)return "wrong dimensions";
      for(int y=0;y<img.Height;y++)for(int x=0;x<img.Width;x++){
        var c=img.GetPixel(x,y);
        if(c.A!=0&&c.A!=255)return "partial opacity at "+x+","+y;
        if(c.A==255&&!accepted.Contains(c.ToArgb()))return "color outside palette at "+x+","+y;
      }
    }
    return null;
  }
}
"@
$manifest=Get-Content assets/sizes.json -Raw|ConvertFrom-Json
$root=(Get-Location).Path
if($Mode -eq 'palette'){
 $paths=@('hillside-tea.png','tea-table.png','scene-sluice.png')|%{Join-Path $root "assets/raw/$_"}
 [PixelArt]::Palette([string[]]$paths)|ConvertTo-Json|Set-Content src/assets/palette.json -Encoding ascii
 exit
}
$palette=[string[]](Get-Content src/assets/palette.json -Raw|ConvertFrom-Json)
if($palette.Count -ne 48 -or ($palette|Sort-Object -Unique).Count -ne 48){throw 'Palette must contain 48 unique colors.'}
$failed=$false
$folder=if($Mode -eq 'pixelize'){'assets/raw'}else{'assets/game'}
if($Mode -eq 'check'){
 foreach($entry in $manifest.PSObject.Properties){
  if(!(Test-Path -LiteralPath (Join-Path 'assets/game' $entry.Name))){Write-Host "FAIL $($entry.Name): missing";$failed=$true}
 }
}
foreach($file in Get-ChildItem -LiteralPath $folder -File){
 $entry=$manifest.PSObject.Properties[$file.Name]
 if(!$entry -or $file.Extension -ne '.png'){Write-Host "FAIL $($file.Name): no PNG size entry";$failed=$true;continue}
 $w,$h=$entry.Value
 if($Mode -eq 'pixelize'){
  [PixelArt]::Render($file.FullName,(Join-Path $root "assets/game/$($file.Name)"),$w,$h,$palette)
  Write-Host "Rendered $($file.Name) ${w}x$h"
 }else{
  $errorText=[PixelArt]::Check($file.FullName,$w,$h,$palette)
  if($errorText){Write-Host "FAIL $($file.Name): $errorText";$failed=$true}else{Write-Host "PASS $($file.Name)"}
 }
}
if($failed){exit 1}
