"""Native DrawingML entrance sequence; one automatic sequence per slide."""
from lxml import etree
P='http://schemas.openxmlformats.org/presentationml/2006/main'
def node(parent,name,**attrs):
 e=etree.SubElement(parent,'{'+P+'}'+name)
 for k,v in attrs.items():e.set(k,str(v))
 return e
def attach_timing(slide,targets,motion,duration_ms=None):
 # All animated elements share one automatic sequence. Related shapes enter together.
 root=slide._element
 transition=etree.Element('{'+P+'}transition',spd='med',advClick='0' if duration_ms else '1')
 if duration_ms:transition.set('advTm',str(duration_ms))
 # Hard scene changes preserve the chapter timestamp; no cumulative transition durations.
 root.append(transition)
 timing=etree.Element('{'+P+'}timing');root.append(timing)
 tn=node(timing,'tnLst');par=node(tn,'par')
 clock=node(par,'cTn',id=1,dur='indefinite',restart='never',nodeType='tmRoot')
 children=node(clock,'childTnLst');seq=node(children,'seq',concurrent=1,nextAc='seek')
 main=node(seq,'cTn',id=2,dur='indefinite',nodeType='mainSeq')
 mainchildren=node(main,'childTnLst');block=node(mainchildren,'par')
 blockclock=node(block,'cTn',id=3,fill='hold')
 node(node(blockclock,'stCondLst'),'cond',delay=0)
 effects=node(blockclock,'childTnLst');counter=4
 for spid,delay_ms in targets:
  effect=node(effects,'par')
  effectclock=node(effect,'cTn',id=counter,presetID=10,presetClass='entr',presetSubtype=0,fill='hold',nodeType='withEffect');counter+=1
  node(node(effectclock,'stCondLst'),'cond',delay=delay_ms)
  kids=node(effectclock,'childTnLst')
  visible=node(kids,'set');behavior=node(visible,'cBhvr')
  node(behavior,'cTn',id=counter,dur=1,fill='hold');counter+=1
  node(node(behavior,'tgtEl'),'spTgt',spid=spid)
  node(node(behavior,'attrNameLst'),'attrName').text='style.visibility'
  node(node(visible,'to'),'strVal',val='visible')
  fade=node(kids,'animEffect',transition='in',filter='fade');behavior=node(fade,'cBhvr')
  node(behavior,'cTn',id=counter,dur=motion['fade']);counter+=1
  node(node(behavior,'tgtEl'),'spTgt',spid=spid)
 for event,name in [('onPrev','prevCondLst'),('onNext','nextCondLst')]:
  cond=node(node(seq,name),'cond',evt=event,delay=0)
  node(node(cond,'tgtEl'),'sldTgt')
 # IDs, valid targets and distinct ordering must survive serialization.
 ids=[x.get('id') for x in timing.iter('{'+P+'}cTn')]
 assert len(ids)==len(set(ids))
 assert all(int(x.get('spid')) in {sh.shape_id for sh in slide.shapes} for x in timing.iter('{'+P+'}spTgt'))
