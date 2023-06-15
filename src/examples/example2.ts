import shajs from "sha.js";

type MerkleNodeValue = string;

function hash(leftNode: MerkleNodeValue, rightNode: MerkleNodeValue) {
  return shajs("sha256")
    .update(leftNode + rightNode, "hex")
    .digest("hex");
}
function computeZeroHashes(height: number): MerkleNodeValue[] {
  let currentZeroHash = "0000000000000000000000000000000000000000000000000000000000000000";
  const zeroHashes: MerkleNodeValue[] = [currentZeroHash];
  for (let i = 1; i <= height; i++) {
    currentZeroHash = hash(currentZeroHash, currentZeroHash);
    zeroHashes.push(currentZeroHash)
  }
  return zeroHashes;
}
class NodeStore {
  nodes: {[id: string]: MerkleNodeValue};
  height: number;
  zeroHashes: MerkleNodeValue[];
  constructor(height: number){
    this.nodes = {};
    this.height = height;
    this.zeroHashes = computeZeroHashes(height);
  }
  contains(level: number, index: number): boolean {
    // check if the node exists in the data store
    return Object.hasOwnProperty.call(this.nodes, level+"_"+index);
  }
  
  set(level: number, index: number, value: MerkleNodeValue){
    // set the value of the node in the data store
    this.nodes[level+"_"+index] = value;
  }

  get(level: number, index: number): MerkleNodeValue {
    if(this.contains(level, index)){
      // if the node is in the datastore, return it
      return this.nodes[level+"_"+index];
    }else{
      // if the node is NOT in the data store, return the correct zero hash for the node's level
      return this.zeroHashes[this.height-level];
    }
  }
}
class ZeroMerkleTree {
  height: number;
  nodeStore: NodeStore;
  constructor(height: number){
    this.height = height;
    this.nodeStore = new NodeStore(height);
  }
  setLeaf(index: number, value: MerkleNodeValue){
    // start traversing the leaf's merkle path at the leaf node
    let currentIndex = index;
    let currentValue = value;

    // don't set the root (level = 0) in the loop, as it has no sibling
    for(let level = this.height; level > 0; level--){
      // set the current node in the tree
      this.nodeStore.set(level, currentIndex, currentValue);

      if(currentIndex % 2 === 0){
        // if the current index is even, then it has a sibling on the right (same level, index = currentIndex+1)
        const rightSibling = this.nodeStore.get(level, currentIndex+1);
        currentValue = hash(currentValue, rightSibling);
      }else{
        // if the current index is odd, then it has a sibling on the left (same level, index = currentIndex-1)
        const leftSibling = this.nodeStore.get(level, currentIndex-1);
        currentValue = hash(leftSibling, currentValue);
      }

      // set current index to the index of the parent node
      currentIndex = Math.floor(currentIndex/2);
    }

    // set the root node (level = 0, index = 0) to current value
    this.nodeStore.set(0, 0, currentValue);
  }
  getRoot(): MerkleNodeValue {
    return this.nodeStore.get(0, 0);
  }

}
function example2(){
  const leavesToSet = [
    "0000000000000000000000000000000000000000000000000000000000000001", // 1
    "0000000000000000000000000000000000000000000000000000000000000003", // 3
    "0000000000000000000000000000000000000000000000000000000000000003", // 3
    "0000000000000000000000000000000000000000000000000000000000000007", // 7
    "0000000000000000000000000000000000000000000000000000000000000004", // 4
    "0000000000000000000000000000000000000000000000000000000000000002", // 2
    "0000000000000000000000000000000000000000000000000000000000000000", // 0
    "0000000000000000000000000000000000000000000000000000000000000006", // 6
  ];
  const tree = new ZeroMerkleTree(3);
  leavesToSet.forEach((leaf, index)=>{
    tree.setLeaf(index, leaf);
  });
  console.log("[example2] the root is: "+tree.getRoot());
}
example2();