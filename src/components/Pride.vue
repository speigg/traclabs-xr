
<template>
    <div id="pride" data-layer-pixel-ratio="0.5">
        <div id="procedure" data-layer><img data-layer class="logo" src="/favicon.ico"/>Procedure: {{procedure}}</div>
        <div id="step" data-layer>Step: {{step}}</div>
        <div id="content">
            <div id="instruction" data-layer data-layer-hover-depth="1">{{instruction}}</div>
            <div id="media">
                <video id="video" webkit-playsinline playsinline="true" crossorigin="anonymous" autoplay muted data-layer v-if="video" :src="video"></video>
                <image id="image" crossorigin="anonymous" data-layer v-if="image" :src="image"></image>
            </div>
        </div>
        <div id="controls">
            <button id="back">Back</button>
            <button id="done">Done</button>
            <button id="xr">Enter XR</button>
        </div>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend()
</script>

<style scoped>
    #pride {
        padding-top: calc(env(safe-area-inset-top));
        padding-left: calc(env(safe-area-inset-left));
        padding-right: calc(env(safe-area-inset-right));
        padding-bottom: calc(env(safe-area-inset-bottom));
        height: 100%;
        color:blue;
        /* background-color:rgba(255,255,255,0.7); */
        font-family: 'Inconsolata', monospace;
        background: linear-gradient(#bef67dcc, #7aece2cc);
        overflow: hidden;
        box-sizing: border-box;
        position: relative;
    }

    @media (min-width: 768px) {
        :not(.xr) #content {
            display: flex;
        }
        :not(.xr) #instruction {
            flex: 1;
            width: 50%;
        }
        :not(.xr) #media {
            flex: 1;
            width: 50%;
        }
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
        margin: 10px;
    }
    #step {
        font-size: 16px;
        margin: 10px;
    }
    #instruction {
        margin: 10px;
        padding: 10px;
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
    #controls {
        position: absolute;
        width: 100%;
        left: 0;
        bottom: 0;
        box-sizing: border-box;
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
        margin-bottom: env(safe-area-inset-bottom);
    }
    button {
        font: 20px bold;
        font-family: 'Inconsolata', monospace;
        margin: 10px;
    }
    #xr {
        float: right;
    }
</style>