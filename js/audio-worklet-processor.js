/**
 * AudioWorkletProcessor for real-time audio processing
 * 用于替代已废弃的ScriptProcessorNode
 */
class AudioStreamProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleRate = 16000; // 目标采样率
        this.bufferSize = 2048;  // 缓冲区大小
        this.inputBuffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        
        // 监听主线程消息
        this.port.onmessage = (event) => {
            if (event.data.type === 'config') {
                this.sampleRate = event.data.sampleRate || 16000;
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        // 如果没有输入，返回true继续处理
        if (!input || !input[0]) {
            return true;
        }
        
        const inputChannel = input[0]; // 单声道
        const inputSampleRate = sampleRate; // 全局采样率
        
        // 如果输入采样率与目标采样率相同，直接处理
        if (inputSampleRate === this.sampleRate) {
            this.processAudioData(inputChannel);
        } else {
            // 需要重采样
            const resampledData = this.resample(inputChannel, inputSampleRate, this.sampleRate);
            this.processAudioData(resampledData);
        }
        
        return true; // 继续处理
    }
    
    /**
     * 处理音频数据
     * @param {Float32Array} audioData 
     */
    processAudioData(audioData) {
        // 将数据添加到缓冲区
        for (let i = 0; i < audioData.length; i++) {
            this.inputBuffer[this.bufferIndex] = audioData[i];
            this.bufferIndex++;
            
            // 当缓冲区满时，发送数据到主线程
            if (this.bufferIndex >= this.bufferSize) {
                // 转换为PCM Int16
                const pcm16 = this.floatToPCM16(this.inputBuffer);
                
                // 发送到主线程
                this.port.postMessage({
                    type: 'audioData',
                    data: pcm16.buffer
                });
                
                // 重置缓冲区
                this.bufferIndex = 0;
            }
        }
    }
    
    /**
     * 简单的重采样算法（线性插值）
     * @param {Float32Array} inputData 
     * @param {number} inputRate 
     * @param {number} outputRate 
     * @returns {Float32Array}
     */
    resample(inputData, inputRate, outputRate) {
        if (inputRate === outputRate) {
            return inputData;
        }
        
        const ratio = inputRate / outputRate;
        const outputLength = Math.floor(inputData.length / ratio);
        const output = new Float32Array(outputLength);
        
        for (let i = 0; i < outputLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
            const fraction = srcIndex - srcIndexFloor;
            
            // 线性插值
            output[i] = inputData[srcIndexFloor] * (1 - fraction) + 
                       inputData[srcIndexCeil] * fraction;
        }
        
        return output;
    }
    
    /**
     * 将Float32数据转换为PCM Int16
     * @param {Float32Array} floatData 
     * @returns {Int16Array}
     */
    floatToPCM16(floatData) {
        const pcm16 = new Int16Array(floatData.length);
        for (let i = 0; i < floatData.length; i++) {
            let sample = Math.max(-1, Math.min(1, floatData[i]));
            pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return pcm16;
    }
}

// 注册处理器
registerProcessor('audio-stream-processor', AudioStreamProcessor);