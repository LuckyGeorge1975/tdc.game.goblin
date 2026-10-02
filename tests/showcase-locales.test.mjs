import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const levels=JSON.parse(readFileSync(new URL('../assets/unit-art/levels/showcase-levels.json',import.meta.url),'utf8')).levels;
const locales=['de','en','es','fr'];

test('each selectable showcase has a complete four-language objective and briefing',()=>{
  for(const locale of locales){
    const catalog=JSON.parse(readFileSync(new URL(`../assets/ui-copy/content-02.${locale}.json`,import.meta.url),'utf8'));
    for(const level of levels){
      const base=`mission.${level.id}.`;
      for(const suffix of ['title','objective.short','objective.full','briefing.short','briefing.full','end.victory']){
        assert.ok(catalog.messages[base+suffix]?.trim(),`${locale}/${base+suffix}`);
      }
      assert.equal(level.objective,'core-and-escort');
      if(locale==='de'){
        assert.equal(catalog.missions[level.id]?.winCondition,'enemy-core-and-all-enemies-destroyed-and-player-survives');
      }
    }
  }
});
