// Liveness projection only. System transitions are resolved by GoblinSystems, never by this view helper.
(function(root){
 const alive=unit=>!!unit&&(unit.catalogSystems?unit.alive===true:unit.hp>0);
 const dead=unit=>!!unit&&(unit.catalogSystems?unit.alive===false:Number.isFinite(unit.hp)&&unit.hp<=0);
 root.GoblinUnitLife=Object.freeze({alive,dead});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.GoblinUnitLife;
})(globalThis);
