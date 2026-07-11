using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Redline.Serialization;

/// <summary>
/// Fábrica que aplica <see cref="DisplayNameEnumConverter{T}"/> a qualquer enum.
/// Resolve os bloqueadores #1 e #2 do cross-check: enums viram string e honram [Display(Name=...)].
/// </summary>
public sealed class DisplayNameEnumConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        var converterType = typeof(DisplayNameEnumConverter<>).MakeGenericType(typeToConvert);
        return (JsonConverter)Activator.CreateInstance(converterType)!;
    }
}

/// <summary>
/// Serializa/desserializa um enum usando o rótulo de [Display(Name=...)] quando existir,
/// caindo para o nome do membro caso contrário. Aceita ambos na leitura (ida e volta).
/// Ex.: BuildStage.Stage1 &lt;=&gt; "Stage 1"; TransmissionType.Automatico &lt;=&gt; "Automático".
/// </summary>
public sealed class DisplayNameEnumConverter<T> : JsonConverter<T> where T : struct, Enum
{
    private readonly Dictionary<T, string> _toName = new();
    private readonly Dictionary<string, T> _fromName = new(StringComparer.OrdinalIgnoreCase);

    public DisplayNameEnumConverter()
    {
        foreach (var value in Enum.GetValues<T>())
        {
            var memberName = value.ToString();
            var display = typeof(T)
                .GetMember(memberName)
                .FirstOrDefault()?
                .GetCustomAttribute<DisplayAttribute>()?
                .Name ?? memberName;

            _toName[value] = display;
            _fromName[display] = value;    // "Stage 1"
            _fromName[memberName] = value; // "Stage1" (tolerância extra)
        }
    }

    public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString();
        if (raw is not null && _fromName.TryGetValue(raw, out var value))
            return value;

        throw new JsonException($"Valor '{raw}' inválido para o enum {typeof(T).Name}.");
    }

    public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toName.TryGetValue(value, out var name) ? name : value.ToString());
    }
}
