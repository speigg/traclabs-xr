
<template>
    <div id="container" data-layer-pixel-ratio="0.5">
        <div id="procedure" data-layer><img data-layer class="logo" src="/favicon.ico"/>Procedure: {{procedure}}</div>
        <div id="step" data-layer>Step: {{step}}</div>
        <div id="instruction" data-layer data-layer-hover-depth="1">{{instruction}}</div>
        <video id="video" webkit-playsinline playsinline="true" crossorigin="anonymous" autoplay muted data-layer v-if="video" :src="video"></video>
        <image id="image" crossorigin="anonymous" data-layer v-if="image" :src="image"></image>
        <div id="controls">
            <button id="back">Back</button>
            <button id="done">Done</button>
        </div>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend()
</script>

<style scoped>
    #container {
        color:blue;
        /* background-color:rgba(255,255,255,0.7); */
        padding: 10px;
        border-width: 3px;
        border-color: black;
        border-style: solid;
        font-family: 'Inconsolata', monospace;
        background: linear-gradient(#bef67dcc, #7aece2cc);
    }
    .logo {
        width: 20px;
        height: 20px;
        margin-right: 8px;
    }
    #procedure {
        /* background-color: transparent; */
        font-size: 20px;
        color:red;
        padding-bottom: 10px;
    }
    #step {
        font-size: 16px;
    }
    #instruction {
        padding: 4px;
        background-color: white;
        color: black;
        border-radius: 5px;
    }
    #instruction.hover {
        background-color: gold;
    }
    #video {
        width: 100%;
        margin-top: 10px;
        margin-bottom: 10px;
    }
</style>