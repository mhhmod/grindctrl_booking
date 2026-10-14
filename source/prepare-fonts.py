"""Create portable static Manrope instances and a local native-render font config."""
from pathlib import Path
from xml.sax.saxutils import escape
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
root=Path(__file__).parent
assets=root/'assets'
for weight,style,name in [(400,'Regular','manrope.ttf'),(700,'Bold','manrope-bold.ttf')]:
 f=instantiateVariableFont(TTFont(assets/'manrope.woff2'),{'wght':weight},inplace=False)
 f.flavor=None
 for n in f['name'].names:
  if n.nameID in [1,2,4,6,16,17]:
   value={1:'Manrope',2:style,4:'Manrope '+style,6:'Manrope-'+style,16:'Manrope',17:style}[n.nameID]
   n.string=value.encode(n.getEncoding(),errors='replace')
 f['OS/2'].usWeightClass=weight
 f['OS/2'].fsSelection=(f['OS/2'].fsSelection & ~(1<<5) & ~(1<<6)) | ((1<<5) if weight==700 else (1<<6))
 f['head'].macStyle=(f['head'].macStyle & ~1) | (1 if weight==700 else 0)
 f.save(assets/name)
(root/'fonts.conf').write_text('<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include><dir>'+escape(str(assets))+'</dir><cachedir>'+escape(str(root/'font-cache'))+'</cachedir></fontconfig>')
print('Native Manrope Regular/Bold fonts and local Fontconfig setup prepared.')
